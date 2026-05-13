import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { getDb } from "@/lib/db";

export const TIKTOK_ROOT = process.env.TIKTOK_ROOT || "/tiktok";
export const PROFILE_VIDEOS_LIMIT = 30;

export interface TiktokProfile {
  username: string;
  displayName: string | null;
  avatarPath: string | null;
  lastSyncedAt: string | null;
  videoCount: number;
}

export interface TiktokVideo {
  videoId: string;
  username: string;
  url: string;
  title: string | null;
  description: string | null;
  duration: number | null;
  uploadDate: string | null;
  hasPoster: boolean;
  hasVideo: boolean;
  posterMtime: number;
  videoMtime: number;
}

const USERNAME_RE = /^[A-Za-z0-9._]+$/;
const VIDEO_ID_RE = /^[0-9]+$/;

export function isValidUsername(s: string): boolean {
  return USERNAME_RE.test(s) && s.length <= 64;
}

export function isValidVideoId(s: string): boolean {
  return VIDEO_ID_RE.test(s) && s.length <= 32;
}

export function profileDir(username: string): string {
  return path.join(TIKTOK_ROOT, username);
}

export function videoPosterPath(username: string, videoId: string): string | null {
  if (!isValidUsername(username) || !isValidVideoId(videoId)) return null;
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const p = path.join(profileDir(username), `${videoId}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Returns path of best playable file: <id>.web.mp4 first, then any <id>.<ext>.
export function videoFilePathFor(username: string, videoId: string): string | null {
  if (!isValidUsername(username) || !isValidVideoId(videoId)) return null;
  const dir = profileDir(username);
  const web = path.join(dir, `${videoId}.web.mp4`);
  if (fs.existsSync(web)) return web;
  for (const ext of ["mp4", "webm", "mov", "m4v"]) {
    const p = path.join(dir, `${videoId}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function listProfiles(): TiktokProfile[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      p.username, p.display_name, p.avatar_path, p.last_synced_at,
      (SELECT COUNT(*) FROM tiktok_videos v WHERE v.username = p.username) AS video_count
    FROM tiktok_profiles p
    ORDER BY p.last_synced_at DESC NULLS LAST, p.created_at DESC
  `).all() as Array<{
    username: string;
    display_name: string | null;
    avatar_path: string | null;
    last_synced_at: string | null;
    video_count: number;
  }>;
  return rows.map((r) => ({
    username: r.username,
    displayName: r.display_name,
    avatarPath: r.avatar_path,
    lastSyncedAt: r.last_synced_at,
    videoCount: r.video_count,
  }));
}

interface VideoRow {
  video_id: string;
  username: string;
  url: string;
  title: string | null;
  description: string | null;
  duration: number | null;
  upload_date: string | null;
}

function rowToVideo(r: VideoRow): TiktokVideo {
  const poster = videoPosterPath(r.username, r.video_id);
  const video = videoFilePathFor(r.username, r.video_id);
  return {
    videoId: r.video_id,
    username: r.username,
    url: r.url,
    title: r.title,
    description: r.description,
    duration: r.duration,
    uploadDate: r.upload_date,
    hasPoster: poster !== null,
    hasVideo: video !== null,
    posterMtime: poster ? fs.statSync(poster).mtimeMs : 0,
    videoMtime: video ? fs.statSync(video).mtimeMs : 0,
  };
}

export function listVideosForProfile(username: string): TiktokVideo[] {
  if (!isValidUsername(username)) return [];
  const db = getDb();
  const rows = db.prepare(`
    SELECT video_id, username, url, title, description, duration, upload_date
    FROM tiktok_videos
    WHERE username = ?
    ORDER BY upload_date DESC, created_at DESC
  `).all(username) as VideoRow[];
  return rows.map(rowToVideo);
}

// Cross-profile feed, newest first. Used by the unified /tiktok page.
export function listAllVideos(limit = 200): TiktokVideo[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT video_id, username, url, title, description, duration, upload_date
    FROM tiktok_videos
    ORDER BY upload_date DESC, created_at DESC
    LIMIT ?
  `).all(limit) as VideoRow[];
  return rows.map(rowToVideo);
}

export function findVideo(videoId: string): { username: string; url: string } | null {
  if (!isValidVideoId(videoId)) return null;
  const db = getDb();
  const row = db.prepare(
    "SELECT username, url FROM tiktok_videos WHERE video_id = ?",
  ).get(videoId) as { username: string; url: string } | undefined;
  return row ?? null;
}

// ---------- yt-dlp wrappers ----------

interface YtdlpEntry {
  id: string;
  url?: string;
  webpage_url?: string;
  title?: string;
  description?: string;
  duration?: number;
  upload_date?: string; // YYYYMMDD
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

// Resolves a profile URL to its uploader info + flat list of videos
// (metadata only, no download).
export async function fetchProfileEntries(profileUrl: string, limit = PROFILE_VIDEOS_LIMIT): Promise<YtdlpProfileResult> {
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

// Resolves full metadata for a single video URL.
export async function fetchVideoMeta(videoUrl: string): Promise<YtdlpEntry> {
  const { stdout, code } = await runYtdlp([
    "--dump-single-json",
    "--no-warnings",
    videoUrl,
  ], 60_000);
  if (code !== 0) throw new Error("yt-dlp failed to resolve video");
  return JSON.parse(stdout) as YtdlpEntry;
}

// Downloads the actual video bytes + thumbnail to disk.
export async function downloadVideo(videoUrl: string, dir: string, videoId: string): Promise<{ videoFile: string; thumbFile: string | null }> {
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${videoId}.%(ext)s`);
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
    .map((e) => path.join(dir, `${videoId}.${e}`))
    .find((p) => fs.existsSync(p));
  if (!videoFile) throw new Error("download succeeded but video file not found");
  const thumbFile = ["jpg", "jpeg", "png", "webp"]
    .map((e) => path.join(dir, `${videoId}.${e}`))
    .find((p) => fs.existsSync(p)) ?? null;
  return { videoFile, thumbFile };
}

// Downloads only the thumbnail (used during profile import).
export async function downloadThumbnail(thumbnailUrl: string, dir: string, videoId: string): Promise<string | null> {
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${videoId}.jpg`);
  return new Promise((resolve) => {
    const proc = spawn("yt-dlp", [
      "--no-warnings",
      "--no-download",
      "--no-write-info-json",
      "--no-write-description",
      "--write-thumbnail",
      "--convert-thumbnails", "jpg",
      "-o", path.join(dir, `${videoId}.%(ext)s`),
      thumbnailUrl,
    ], { stdio: "ignore" });
    proc.on("close", (code) => {
      resolve(code === 0 && fs.existsSync(out) ? out : null);
    });
    setTimeout(() => proc.kill("SIGKILL"), 60_000);
  });
}

// ---------- DB persistence ----------

export function upsertProfile(input: {
  username: string;
  displayName?: string | null;
  avatarPath?: string | null;
  markSyncedNow?: boolean;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO tiktok_profiles (username, display_name, avatar_path, last_synced_at)
    VALUES (?, ?, ?, ${input.markSyncedNow ? "CURRENT_TIMESTAMP" : "NULL"})
    ON CONFLICT(username) DO UPDATE SET
      display_name = COALESCE(excluded.display_name, tiktok_profiles.display_name),
      avatar_path  = COALESCE(excluded.avatar_path, tiktok_profiles.avatar_path)
      ${input.markSyncedNow ? ", last_synced_at = CURRENT_TIMESTAMP" : ""}
  `).run(input.username, input.displayName ?? null, input.avatarPath ?? null);
}

export function upsertVideo(v: {
  videoId: string;
  username: string;
  url: string;
  title?: string | null;
  description?: string | null;
  duration?: number | null;
  uploadDate?: string | null;
  thumbnailPath?: string | null;
  videoPath?: string | null;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO tiktok_videos (video_id, username, url, title, description, duration, upload_date, thumbnail_path, video_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(video_id) DO UPDATE SET
      title          = COALESCE(excluded.title, tiktok_videos.title),
      description    = COALESCE(excluded.description, tiktok_videos.description),
      duration       = COALESCE(excluded.duration, tiktok_videos.duration),
      upload_date    = COALESCE(excluded.upload_date, tiktok_videos.upload_date),
      thumbnail_path = COALESCE(excluded.thumbnail_path, tiktok_videos.thumbnail_path),
      video_path     = COALESCE(excluded.video_path, tiktok_videos.video_path)
  `).run(
    v.videoId, v.username, v.url, v.title ?? null, v.description ?? null,
    v.duration ?? null, v.uploadDate ?? null, v.thumbnailPath ?? null, v.videoPath ?? null,
  );
}

export function markDownloaded(videoId: string, videoPath: string) {
  const db = getDb();
  db.prepare(`
    UPDATE tiktok_videos
    SET video_path = ?, downloaded_at = CURRENT_TIMESTAMP
    WHERE video_id = ?
  `).run(videoPath, videoId);
}

export function markWatched(videoId: string) {
  const db = getDb();
  db.prepare(`
    UPDATE tiktok_videos SET last_watched_at = CURRENT_TIMESTAMP WHERE video_id = ?
  `).run(videoId);
}

export function setTiktokTitle(videoId: string, title: string): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE tiktok_videos SET title = ? WHERE video_id = ?")
    .run(title, videoId);
  return result.changes > 0;
}

export function listProfileUsernames(): string[] {
  const db = getDb();
  return (db.prepare("SELECT username FROM tiktok_profiles ORDER BY username")
    .all() as { username: string }[]).map((r) => r.username);
}

// Re-poll a profile and add metadata for new videos (no video downloads).
// Returns the count of newly added videos.
export async function syncProfile(username: string): Promise<number> {
  if (!isValidUsername(username)) throw new Error("Invalid username");
  const data = await fetchProfileEntries(
    `https://www.tiktok.com/@${username}`,
    PROFILE_VIDEOS_LIMIT,
  );
  upsertProfile({
    username,
    displayName: data.uploader,
    markSyncedNow: true,
  });
  const db = getDb();
  const existingIds = new Set(
    (db.prepare("SELECT video_id FROM tiktok_videos WHERE username = ?")
      .all(username) as { video_id: string }[]).map((r) => r.video_id),
  );
  let added = 0;
  for (const entry of data.entries) {
    const videoId = String(entry.id);
    if (existingIds.has(videoId)) continue;
    const videoUrl = entry.webpage_url || entry.url ||
      `https://www.tiktok.com/@${username}/video/${videoId}`;
    let thumbPath: string | null = null;
    if (entry.thumbnail) {
      thumbPath = await downloadThumbnail(entry.thumbnail, profileDir(username), videoId);
    }
    upsertVideo({
      videoId,
      username,
      url: videoUrl,
      title: entry.title ?? null,
      description: entry.description ?? null,
      duration: entry.duration ?? null,
      uploadDate: entry.upload_date ?? null,
      thumbnailPath: thumbPath,
    });
    added++;
  }
  return added;
}

// ---------- URL parsing ----------

export interface ParsedTiktokUrl {
  kind: "profile" | "video";
  username?: string;
  videoId?: string;
  normalizedUrl: string;
}

export function parseTiktokUrl(input: string): ParsedTiktokUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)tiktok\.com$/.test(url.hostname)) return null;

  // Profile: /@username
  const profileMatch = url.pathname.match(/^\/@([A-Za-z0-9._]+)\/?$/);
  if (profileMatch) {
    return {
      kind: "profile",
      username: profileMatch[1],
      normalizedUrl: `https://www.tiktok.com/@${profileMatch[1]}`,
    };
  }

  // Single video: /@username/video/<id>
  const videoMatch = url.pathname.match(/^\/@([A-Za-z0-9._]+)\/video\/(\d+)/);
  if (videoMatch) {
    return {
      kind: "video",
      username: videoMatch[1],
      videoId: videoMatch[2],
      normalizedUrl: `https://www.tiktok.com/@${videoMatch[1]}/video/${videoMatch[2]}`,
    };
  }

  return null;
}
