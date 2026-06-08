import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import matter from "gray-matter";
import { getDb } from "@/lib/db";
import { CLIPS_ROOT, isValidProfile } from "@/lib/clips";

// Phase-1 backbone for the unified Shorties library: profile registry +
// yt-dlp-driven sync. Replaces the standalone tiktok pipeline. Manual
// drop-in profiles coexist (auto_poll=0, source_url=NULL).

export interface ClipProfile {
  name: string;
  displayName: string | null;
  sourceUrl: string | null;
  sourceKind: string | null;
  autoPoll: boolean;
  videosLimit: number | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

interface ClipProfileRow {
  name: string;
  display_name: string | null;
  source_url: string | null;
  source_kind: string | null;
  auto_poll: number;
  videos_limit: number | null;
  last_synced_at: string | null;
  created_at: string;
}

function rowToProfile(r: ClipProfileRow): ClipProfile {
  return {
    name: r.name,
    displayName: r.display_name,
    sourceUrl: r.source_url,
    sourceKind: r.source_kind,
    autoPoll: r.auto_poll === 1,
    videosLimit: r.videos_limit,
    lastSyncedAt: r.last_synced_at,
    createdAt: r.created_at,
  };
}

export function getClipProfile(name: string): ClipProfile | null {
  if (!isValidProfile(name)) return null;
  const row = getDb()
    .prepare("SELECT * FROM clip_profiles WHERE name = ?")
    .get(name) as ClipProfileRow | undefined;
  return row ? rowToProfile(row) : null;
}

export function listClipProfiles(): ClipProfile[] {
  const rows = getDb()
    .prepare("SELECT * FROM clip_profiles ORDER BY last_synced_at DESC, name ASC")
    .all() as ClipProfileRow[];
  return rows.map(rowToProfile);
}

export function listAutoPollProfiles(): ClipProfile[] {
  const rows = getDb()
    .prepare("SELECT * FROM clip_profiles WHERE auto_poll = 1 ORDER BY last_synced_at ASC NULLS FIRST")
    .all() as ClipProfileRow[];
  return rows.map(rowToProfile);
}

export function upsertClipProfile(input: {
  name: string;
  displayName?: string | null;
  sourceUrl?: string | null;
  sourceKind?: string | null;
  autoPoll?: boolean;
  videosLimit?: number | null;
}): ClipProfile {
  if (!isValidProfile(input.name)) throw new Error("Invalid profile name");
  if (input.videosLimit !== undefined && input.videosLimit !== null) {
    if (!Number.isInteger(input.videosLimit) || input.videosLimit < 1 || input.videosLimit > 1000) {
      throw new Error("videos_limit must be an integer in [1, 1000]");
    }
  }
  const db = getDb();
  // SQLite enforces NOT NULL during the INSERT branch of UPSERT even when
  // ON CONFLICT will redirect to UPDATE, so we cannot pass NULL for
  // auto_poll. Default unspecified to 0 on insert; preserve existing
  // value on update via the sentinel below.
  const autoPollInsert = input.autoPoll === true ? 1 : 0;
  const autoPollExplicit = input.autoPoll === undefined ? null : (input.autoPoll ? 1 : 0);
  const videosLimitInsert = input.videosLimit ?? null;
  db.prepare(`
    INSERT INTO clip_profiles (name, display_name, source_url, source_kind, auto_poll, videos_limit)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      display_name = COALESCE(excluded.display_name, clip_profiles.display_name),
      source_url   = COALESCE(excluded.source_url,   clip_profiles.source_url),
      source_kind  = COALESCE(excluded.source_kind,  clip_profiles.source_kind),
      auto_poll    = COALESCE(?, clip_profiles.auto_poll),
      videos_limit = COALESCE(excluded.videos_limit, clip_profiles.videos_limit)
  `).run(
    input.name,
    input.displayName ?? null,
    input.sourceUrl ?? null,
    input.sourceKind ?? null,
    autoPollInsert,
    videosLimitInsert,
    autoPollExplicit,
  );
  return getClipProfile(input.name)!;
}

export function setAutoPoll(name: string, on: boolean): void {
  getDb()
    .prepare("UPDATE clip_profiles SET auto_poll = ? WHERE name = ?")
    .run(on ? 1 : 0, name);
}

export function markProfileSyncedNow(name: string): void {
  getDb()
    .prepare("UPDATE clip_profiles SET last_synced_at = CURRENT_TIMESTAMP WHERE name = ?")
    .run(name);
}

// ---------- yt-dlp ----------

interface YtdlpEntry {
  id: string;
  url?: string;
  webpage_url?: string;
  title?: string;
  description?: string;
  duration?: number;
  upload_date?: string;
  thumbnail?: string;
  uploader?: string;
  uploader_id?: string;
  channel?: string;
}

interface YtdlpProfileResult {
  uploader: string | null;
  uploader_id: string | null;
  entries: YtdlpEntry[];
}

export const DEFAULT_PROFILE_VIDEOS_LIMIT = 30;

function runYtdlp(args: string[], timeoutMs = 120_000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const t = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      clearTimeout(t);
      resolve({ stdout, stderr, code: code ?? -1 });
    });
  });
}

export async function fetchProfileEntries(
  profileUrl: string,
  limit = DEFAULT_PROFILE_VIDEOS_LIMIT,
): Promise<YtdlpProfileResult> {
  const { stdout, code } = await runYtdlp([
    "--flat-playlist",
    "--dump-single-json",
    "--playlist-end", String(limit),
    "--no-warnings",
    profileUrl,
  ], 180_000);
  if (code !== 0) throw new Error("yt-dlp failed to resolve profile");
  const data = JSON.parse(stdout) as {
    uploader?: string;
    uploader_id?: string;
    channel?: string;
    entries?: YtdlpEntry[];
  };
  return {
    uploader: data.uploader ?? data.channel ?? null,
    uploader_id: data.uploader_id ?? null,
    entries: data.entries ?? [],
  };
}

export async function fetchVideoMeta(videoUrl: string): Promise<YtdlpEntry> {
  const { stdout, code } = await runYtdlp([
    "--dump-single-json",
    "--no-warnings",
    videoUrl,
  ], 60_000);
  if (code !== 0) throw new Error("yt-dlp failed to resolve video");
  return JSON.parse(stdout) as YtdlpEntry;
}

// Downloads video + thumbnail to <CLIPS_ROOT>/<profile>/<basename>.{mp4,jpg}.
async function downloadVideoToProfile(
  videoUrl: string,
  profile: string,
  basename: string,
): Promise<{ videoFile: string; thumbFile: string | null }> {
  const dir = path.join(CLIPS_ROOT, profile);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${basename}.%(ext)s`);
  const { code } = await runYtdlp([
    "-f", "best[ext=mp4]/best",
    "--write-thumbnail",
    "--convert-thumbnails", "jpg",
    "--no-warnings",
    "-o", out,
    videoUrl,
  ], 300_000);
  if (code !== 0) throw new Error("yt-dlp failed to download video");
  const videoFile = ["mp4", "webm", "mov", "m4v"]
    .map((e) => path.join(dir, `${basename}.${e}`))
    .find((p) => fs.existsSync(p));
  if (!videoFile) throw new Error("download succeeded but video file not found");
  const thumbFile = ["jpg", "jpeg", "png", "webp"]
    .map((e) => path.join(dir, `${basename}.${e}`))
    .find((p) => fs.existsSync(p)) ?? null;
  return { videoFile, thumbFile };
}

// Writes <CLIPS_ROOT>/<profile>/<basename>.md with frontmatter pulled from
// yt-dlp metadata. Mirrors the shape consumed by clips.ts readMetaFor.
function writeClipMd(profile: string, basename: string, entry: YtdlpEntry) {
  const dir = path.join(CLIPS_ROOT, profile);
  const mdPath = path.join(dir, `${basename}.md`);
  if (fs.existsSync(mdPath)) return;
  const data: Record<string, unknown> = {};
  if (entry.title) data.title = entry.title;
  if (entry.description) data.description = entry.description;
  if (entry.uploader || entry.channel) data.uploader = entry.uploader ?? entry.channel;
  if (entry.webpage_url || entry.url) data.url = entry.webpage_url ?? entry.url;
  if (entry.upload_date) data.upload_date = entry.upload_date;
  if (typeof entry.duration === "number") data.duration = entry.duration;
  const content = matter.stringify("", data);
  fs.writeFileSync(mdPath, content, "utf-8");
}

// Detect basenames already present in the profile folder to avoid
// re-downloading. We check for any of <basename>.{mp4,webm,mov,m4v,web.mp4}.
export function existingBasenames(profile: string): Set<string> {
  const dir = path.join(CLIPS_ROOT, profile);
  if (!fs.existsSync(dir)) return new Set();
  const out = new Set<string>();
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+?)\.(mp4|webm|mov|m4v|web\.mp4)$/i);
    if (m) out.add(m[1]);
  }
  return out;
}

export function listSkippedVideoIds(profile: string): Set<string> {
  const rows = getDb()
    .prepare("SELECT video_id FROM clip_profile_skipped WHERE profile = ?")
    .all(profile) as { video_id: string }[];
  return new Set(rows.map((r) => r.video_id));
}

export function markVideoSkipped(profile: string, videoId: string): void {
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO clip_profile_skipped (profile, video_id) VALUES (?, ?)",
    )
    .run(profile, videoId);
}

export function unmarkVideoSkipped(profile: string, videoId: string): void {
  getDb()
    .prepare("DELETE FROM clip_profile_skipped WHERE profile = ? AND video_id = ?")
    .run(profile, videoId);
}

// Download one specific video into a profile (used by the manual-pick UI).
// Writes the .md frontmatter and clears any skip entry for the same id.
export async function downloadSingleVideo(
  profile: string,
  videoUrl: string,
  videoId: string,
): Promise<{ videoId: string; videoFile: string }> {
  if (!getClipProfile(profile)) throw new Error("Unknown profile");
  const fullEntry = await fetchVideoMeta(videoUrl).catch(
    () => ({ id: videoId, webpage_url: videoUrl } as YtdlpEntry),
  );
  const { videoFile } = await downloadVideoToProfile(videoUrl, profile, videoId);
  writeClipMd(profile, videoId, fullEntry);
  unmarkVideoSkipped(profile, videoId);
  return { videoId, videoFile };
}

// Poll a profile's source_url, download any new videos, write .md frontmatter,
// update last_synced_at. Returns the count of newly downloaded videos.
export async function syncClipProfile(name: string): Promise<{
  profile: string;
  added: number;
  skipped: number;
  errors: { videoId: string; error: string }[];
}> {
  const profile = getClipProfile(name);
  if (!profile) throw new Error("Unknown profile");
  if (!profile.sourceUrl) throw new Error("Profile has no source_url configured");

  const limit = profile.videosLimit ?? DEFAULT_PROFILE_VIDEOS_LIMIT;
  const userSkipped = listSkippedVideoIds(name);
  // Expand the yt-dlp window so the limit window still contains `limit`
  // candidate (non-skipped) videos. Without this, every user-deleted video
  // permanently shrinks the local library by one.
  const fetchLimit = Math.min(500, limit + userSkipped.size);
  const data = await fetchProfileEntries(profile.sourceUrl, fetchLimit);
  upsertClipProfile({
    name,
    displayName: data.uploader,
  });

  const existing = existingBasenames(name);
  let added = 0;
  let skipped = 0;
  const errors: { videoId: string; error: string }[] = [];
  // Walk newest-first; stop once we've reached `limit` videos that are
  // already on disk OR newly downloaded.
  let inWindow = 0;

  for (const entry of data.entries) {
    if (inWindow >= limit) break;
    const videoId = String(entry.id);
    if (existing.has(videoId)) { inWindow++; skipped++; continue; }
    if (userSkipped.has(videoId)) { skipped++; continue; }
    const videoUrl =
      entry.webpage_url ||
      entry.url ||
      `${profile.sourceUrl.replace(/\/$/, "")}/video/${videoId}`;
    try {
      const fullEntry = await fetchVideoMeta(videoUrl).catch(() => entry);
      await downloadVideoToProfile(videoUrl, name, videoId);
      writeClipMd(name, videoId, fullEntry);
      added++;
      inWindow++;
    } catch (err: any) {
      errors.push({ videoId, error: err?.message || "unknown" });
    }
  }

  markProfileSyncedNow(name);
  return { profile: name, added, skipped, errors };
}

// Bulk sync: poll every profile flagged auto_poll=1, oldest-synced first.
export async function syncAllAutoPollProfiles(): Promise<{
  profile: string;
  added: number;
  skipped: number;
  errors: { videoId: string; error: string }[];
}[]> {
  const profiles = listAutoPollProfiles();
  const results = [] as Awaited<ReturnType<typeof syncClipProfile>>[];
  for (const p of profiles) {
    try {
      results.push(await syncClipProfile(p.name));
    } catch (err: any) {
      results.push({ profile: p.name, added: 0, skipped: 0, errors: [{ videoId: "*", error: err?.message || "unknown" }] });
    }
  }
  return results;
}
