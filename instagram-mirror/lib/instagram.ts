import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { getDb } from "./db";
import { PHOTOS_ROOT, isValidProfile } from "./photos";

const INSTAGRAM_USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;

export interface IgProfile {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  postCount: number | null;
  addedAt: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  /** True when there's actually a `<root>/<username>/` folder on disk. */
  hasFiles: boolean;
  fileCount: number;
}

/** Extract the profile username from any Instagram URL or accept a bare username. */
export function parseInstagramUrl(input: string): string | null {
  const trimmed = input.trim().replace(/^@/, "");
  if (!trimmed) return null;
  if (INSTAGRAM_USERNAME_RE.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (!u.hostname.includes("instagram.com")) return null;
    // Path forms: /username/, /username, /username/p/<id>/, /username/reel/<id>/
    const parts = u.pathname.split("/").filter(Boolean);
    const candidate = parts[0];
    if (candidate && INSTAGRAM_USERNAME_RE.test(candidate)) return candidate;
  } catch {
    /* fall through */
  }
  return null;
}

export function listProfiles(): IgProfile[] {
  const db = getDb();
  // Auto-import any profile folders that exist on disk but aren't tracked
  // yet. Lets the user dump folders into /mnt/4tb/elite/instagram/<u>/
  // manually and have them surface in Manage with no extra step.
  try {
    const onDisk = fs.existsSync(PHOTOS_ROOT) ? fs.readdirSync(PHOTOS_ROOT, { withFileTypes: true }) : [];
    const insert = db.prepare("INSERT OR IGNORE INTO instagram_profiles (username) VALUES (?)");
    for (const e of onDisk) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
      if (!INSTAGRAM_USERNAME_RE.test(e.name)) continue;
      insert.run(e.name);
    }
  } catch {
    /* ignore */
  }

  const rows = db
    .prepare(
      `SELECT username, display_name AS displayName, bio, avatar_url AS avatarUrl,
              post_count AS postCount, added_at AS addedAt,
              last_synced_at AS lastSyncedAt, last_sync_error AS lastSyncError
         FROM instagram_profiles
        ORDER BY added_at DESC`,
    )
    .all() as Array<Omit<IgProfile, "hasFiles" | "fileCount">>;
  return rows.map((r) => {
    const dir = path.join(PHOTOS_ROOT, r.username);
    let fileCount = 0;
    let hasFiles = false;
    try {
      const stat = fs.statSync(dir);
      if (stat.isDirectory()) {
        hasFiles = true;
        fileCount = fs.readdirSync(dir).filter((n) => !n.startsWith(".")).length;
      }
    } catch {
      /* missing dir */
    }
    return { ...r, hasFiles, fileCount };
  });
}

export function getProfile(username: string): IgProfile | null {
  const all = listProfiles();
  return all.find((p) => p.username === username) ?? null;
}

export function listProfileUsernames(): string[] {
  const db = getDb();
  return (db.prepare("SELECT username FROM instagram_profiles ORDER BY username").all() as Array<{ username: string }>)
    .map((r) => r.username);
}

export function addProfile(username: string): IgProfile | null {
  if (!INSTAGRAM_USERNAME_RE.test(username) || !isValidProfile(username)) return null;
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO instagram_profiles (username) VALUES (?)",
  ).run(username);
  // Pre-create the storage folder so an immediate sync has somewhere to land.
  try {
    fs.mkdirSync(path.join(PHOTOS_ROOT, username), { recursive: true });
  } catch {
    /* ignore */
  }
  return getProfile(username);
}

export function deleteProfile(username: string): boolean {
  const db = getDb();
  const r = db
    .prepare("DELETE FROM instagram_profiles WHERE username = ?")
    .run(username);
  return r.changes > 0;
}

const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".m4v", ".mkv"]);

/**
 * Delete every video file in the profile's folder (and any same-name .json
 * sidecars + posters). Useful when switching a profile to "photos only" and
 * cleaning up previously-downloaded reels. Returns the number of files
 * removed.
 */
export function deleteSavedVideos(username: string): { removed: number } {
  if (!INSTAGRAM_USERNAME_RE.test(username)) return { removed: 0 };
  const dir = path.join(PHOTOS_ROOT, username);
  if (!fs.existsSync(dir)) return { removed: 0 };

  let removed = 0;
  const entries = fs.readdirSync(dir);
  // Pass 1: identify video files (and their .web.mp4 transcoded variants).
  const videoBases: string[] = [];
  for (const name of entries) {
    const lower = name.toLowerCase();
    if (lower.endsWith(".web.mp4")) {
      videoBases.push(name.slice(0, -".web.mp4".length));
    } else {
      const dot = name.lastIndexOf(".");
      if (dot < 0) continue;
      const ext = lower.slice(dot);
      if (VIDEO_EXTS.has(ext)) videoBases.push(name.slice(0, dot));
    }
  }
  const baseSet = new Set(videoBases);

  // Pass 2: delete the video files themselves + any matching .json/.txt
  // sidecar that yt-dlp left next to them.
  for (const name of entries) {
    const lower = name.toLowerCase();
    const isVideo =
      lower.endsWith(".web.mp4") ||
      [".mp4", ".webm", ".mov", ".m4v", ".mkv"].some((ext) => lower.endsWith(ext));
    if (isVideo) {
      try {
        fs.unlinkSync(path.join(dir, name));
        removed++;
      } catch {
        /* ignore */
      }
      continue;
    }
    // Sidecars: match on basename without extension
    const dot = name.lastIndexOf(".");
    if (dot < 0) continue;
    const base = name.slice(0, dot);
    const ext = lower.slice(dot);
    if (!baseSet.has(base)) continue;
    if (ext === ".info.json" || ext === ".json") {
      try {
        fs.unlinkSync(path.join(dir, name));
        removed++;
      } catch {
        /* ignore */
      }
    }
  }
  return { removed };
}

function recordSyncResult(username: string, error: string | null): void {
  const db = getDb();
  db.prepare(
    `UPDATE instagram_profiles
        SET last_synced_at = CURRENT_TIMESTAMP,
            last_sync_error = ?
      WHERE username = ?`,
  ).run(error, username);
}

function recordProfileMeta(
  username: string,
  meta: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null; postCount?: number | null },
): void {
  const db = getDb();
  db.prepare(
    `UPDATE instagram_profiles
        SET display_name    = COALESCE(?, display_name),
            bio             = COALESCE(?, bio),
            avatar_url      = COALESCE(?, avatar_url),
            post_count      = COALESCE(?, post_count),
            last_sync_error = NULL
      WHERE username = ?`,
  ).run(
    meta.displayName ?? null,
    meta.bio ?? null,
    meta.avatarUrl ?? null,
    meta.postCount ?? null,
    username,
  );
}

function run(cmd: string, args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd });
    let stdout = "";
    let stderr = "";
    let killed = false;
    const t = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs ?? 5 * 60 * 1000);
    child.stdout?.on("data", (b) => { stdout += b.toString(); });
    child.stderr?.on("data", (b) => { stderr += b.toString(); });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ code: killed ? 124 : code ?? 1, stdout, stderr });
    });
    child.on("error", () => {
      clearTimeout(t);
      resolve({ code: 127, stdout, stderr });
    });
  });
}

// Resolved by PATH; both binaries are installed in the runner image (see
// Dockerfile). Using bare names lets the same code work on the host too.
const YT_DLP = "yt-dlp";
const GALLERY_DL = "gallery-dl";

// Optional Netscape-format cookies file for authenticated requests.
// User drops it at the path below (visible in container at the same path
// because /store maps to /mnt/4tb/elite). When present, fetchProfileInfo +
// syncProfile both pass it through so Instagram treats us as a logged-in
// session and stops returning 429/login-redirects.
//
// Easy way to make one: install a "Get cookies.txt LOCALLY" browser
// extension, log in to instagram.com, click the extension, save the file
// at this path:
//   /mnt/4tb/elite/instagram/.cookies.txt
const COOKIES_PATH = process.env.IG_COOKIES_PATH || "/store/instagram/.cookies.txt";

export function cookiesFilePath(): string {
  return COOKIES_PATH;
}

export function hasCookies(): boolean {
  try {
    return fs.statSync(COOKIES_PATH).size > 0;
  } catch {
    return false;
  }
}

/** Parse the Netscape cookies.txt and return a `name=value; ...` Cookie header. */
function readCookieHeader(): string | null {
  if (!hasCookies()) return null;
  try {
    const raw = fs.readFileSync(COOKIES_PATH, "utf-8");
    const cookies: string[] = [];
    for (const line of raw.split("\n")) {
      const t = line.replace(/^#HttpOnly_/, "").trim();
      if (!t || t.startsWith("#")) continue;
      const parts = t.split("\t");
      if (parts.length < 7) continue;
      const [domain, , , , , name, value] = parts;
      if (!domain.includes("instagram.com")) continue;
      cookies.push(`${name}=${value}`);
    }
    return cookies.length > 0 ? cookies.join("; ") : null;
  } catch {
    return null;
  }
}

export interface SyncResult {
  ok: boolean;
  tool: "yt-dlp" | "gallery-dl" | null;
  mode: SyncMode;
  filesBefore: number;
  filesAfter: number;
  added: number;
  error: string | null;
}

export type SyncMode = "all" | "photos";

export function isValidSyncMode(s: string): s is SyncMode {
  return s === "all" || s === "photos";
}

/**
 * Sync (download new posts) for a profile.
 *
 * mode === "all" (default): Tries yt-dlp first since it's robust for video
 * posts; falls back to gallery-dl for image-only profiles + stories.
 *
 * mode === "photos": Skips yt-dlp entirely (videos are filtered out) and
 * uses gallery-dl with `extractor.instagram.videos=false` so reels and
 * video posts are skipped at scrape time.
 */
export async function syncProfile(
  username: string,
  opts: { mode?: SyncMode } = {},
): Promise<SyncResult> {
  const mode: SyncMode = opts.mode === "photos" ? "photos" : "all";
  if (!INSTAGRAM_USERNAME_RE.test(username)) {
    return {
      ok: false, tool: null, mode,
      filesBefore: 0, filesAfter: 0, added: 0, error: "Invalid username",
    };
  }
  const dir = path.join(PHOTOS_ROOT, username);
  fs.mkdirSync(dir, { recursive: true });
  const before = fs.readdirSync(dir).filter((n) => !n.startsWith(".")).length;

  const cookiesPath = hasCookies() ? COOKIES_PATH : null;

  let tool: SyncResult["tool"] = null;
  let result: { code: number; stdout: string; stderr: string } = { code: 0, stdout: "", stderr: "" };

  // Per-profile archive files: yt-dlp uses one-id-per-line text, gallery-dl
  // uses an SQLite db. Both let the tool skip already-downloaded items so
  // every "Sync" click adds *new* posts (newer ones that appeared since
  // last sync, or older backlog when nothing new is available).
  const ytArchive = path.join(dir, ".yt-dlp-archive.txt");
  const gdArchive = path.join(dir, ".gallery-dl-archive.sqlite");

  if (mode === "all") {
    // Try yt-dlp first (output template lands files at <dir>/<id>.<ext>).
    // --max-downloads counts only fresh downloads; archive-skipped items
    // don't count toward the limit, so this caps the sync to 30 NEW items.
    const ytArgs = [
      `https://www.instagram.com/${username}/`,
      "-o", `${username}_-_%(title).80B_%(id)s.%(ext)s`,
      "--no-overwrites",
      "--ignore-errors",
      "--no-warnings",
      "--no-progress",
      "--write-info-json",
      "--download-archive", ytArchive,
      "--max-downloads", "30",
    ];
    if (cookiesPath) ytArgs.push("--cookies", cookiesPath);
    tool = "yt-dlp";
    result = await run(YT_DLP, ytArgs, { cwd: dir, timeoutMs: 5 * 60 * 1000 });
  }

  // gallery-dl runs unconditionally for "photos" mode, and as fallback in
  // "all" mode when yt-dlp failed or returned nothing new.
  const afterYt = fs.readdirSync(dir).filter((n) => !n.startsWith(".")).length;
  if (mode === "photos" || afterYt === before || result.code !== 0) {
    tool = "gallery-dl";
    // Dynamic range: scan up to (currentCount + 30) items in the listing so
    // each click can add ~30 new (gallery-dl skips archived ones inside the
    // range). Cap the upper bound so a stale archive can't trigger a
    // thousand-item walk on a huge profile.
    const before2 = fs.readdirSync(dir).filter((n) => !n.startsWith(".")).length;
    const rangeUpper = Math.min(before2 + 30, 500);
    const gdArgs = [
      `https://www.instagram.com/${username}/`,
      "-d", path.join(PHOTOS_ROOT, username),
      "--directory", "",
      "--filename",
      `${username}_-_{shortcode|post_shortcode|id}_{num|0}.{extension}`,
      "--range", `1-${rangeUpper}`,
      "--download-archive", gdArchive,
    ];
    if (mode === "photos") {
      // Tell gallery-dl's instagram extractor to skip video posts so we
      // only get image posts + image carousels.
      gdArgs.push("-o", "videos=false");
    }
    if (cookiesPath) gdArgs.push("--cookies", cookiesPath);
    result = await run(GALLERY_DL, gdArgs, { timeoutMs: 5 * 60 * 1000 });
  }

  const after = fs.readdirSync(dir).filter((n) => !n.startsWith(".")).length;
  const ok = result.code === 0 || after > before;
  const error = ok ? null : (result.stderr || result.stdout || `exit ${result.code}`).slice(0, 500);
  recordSyncResult(username, error);
  return {
    ok, tool, mode,
    filesBefore: before, filesAfter: after,
    added: Math.max(0, after - before), error,
  };
}

/**
 * Fetch profile metadata via Instagram's public `web_profile_info` endpoint.
 * Returns null if the call fails (rate-limit, blocked, profile missing).
 *
 * gallery-dl/yt-dlp both refuse to scrape user metadata without a session
 * cookie now ("NotFoundError: Requested user could not be found"), but the
 * `https://i.instagram.com/api/v1/users/web_profile_info/?username=<u>`
 * endpoint still works anonymously as long as we send the X-IG-App-ID
 * header that IG's own web app uses (`936619743392459` is the public web
 * app ID and has been stable for years).
 *
 * IMPORTANT: we shell out to curl rather than using Node's built-in fetch.
 * Node's fetch sends a TLS/HTTP-fingerprint that Instagram now actively
 * rate-limits with HTTP 429, even when the same network can call the
 * endpoint successfully via curl on HTTP/2. curl is preinstalled in the
 * runner image (see Dockerfile).
 */
export async function fetchProfileInfo(username: string): Promise<{
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  postCount?: number | null;
} | null> {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const cookieHeader = readCookieHeader();
  const args = [
    "-s",
    "--http2",
    "--max-time", "15",
    "-H", "X-IG-App-ID: 936619743392459",
    "-H", "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "-H", "Accept: application/json, text/plain, */*",
    "-H", "Accept-Language: en-US,en;q=0.9",
  ];
  if (cookieHeader) {
    args.push("-H", `Cookie: ${cookieHeader}`);
  }
  args.push(url);
  const result = await run("curl", args, { timeoutMs: 20_000 });
  if (result.code !== 0 || !result.stdout) return null;
  try {
    const data = JSON.parse(result.stdout) as { data?: { user?: Record<string, unknown> } };
    const user = data.data?.user;
    if (!user) return null;
    const meta = {
      displayName: typeof user.full_name === "string" ? user.full_name : null,
      bio: typeof user.biography === "string" ? user.biography : null,
      avatarUrl:
        typeof user.profile_pic_url_hd === "string"
          ? user.profile_pic_url_hd
          : typeof user.profile_pic_url === "string"
            ? user.profile_pic_url
            : null,
      postCount:
        typeof user.edge_owner_to_timeline_media === "object" && user.edge_owner_to_timeline_media !== null
          ? (((user.edge_owner_to_timeline_media as Record<string, unknown>).count) as number) ?? null
          : null,
    };
    recordProfileMeta(username, meta);
    return meta;
  } catch {
    return null;
  }
}
