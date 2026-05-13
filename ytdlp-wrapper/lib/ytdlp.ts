import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execFileAsync = promisify(execFile);

const YTDLP_PATH = process.env.YTDLP_PATH || "/usr/bin/yt-dlp";
const COOKIES_PATH = process.env.YTDLP_COOKIES_PATH || "";

// Prioritise direct HTTPS MP4 streams over HLS for browser compatibility.
const FORMAT =
  "best[protocol=https][ext=mp4]/best[protocol=https]/bestvideo[protocol=https]+bestaudio[protocol=https]/best[ext=mp4]/best";

/** Thrown when yt-dlp returns an auth/cookie-related error. */
export class YtdlpCookieError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "YtdlpCookieError";
  }
}

const COOKIE_ERROR_PATTERNS = [
  "sign in to confirm",
  "not a bot",
  "cookies",
  "confirm your age",
  "members only",
  "login required",
  "private video",
];

function throwIfCookieError(msg: string): void {
  const lower = msg.toLowerCase();
  if (COOKIE_ERROR_PATTERNS.some((p) => lower.includes(p))) {
    throw new YtdlpCookieError(msg);
  }
}

/** Build common args shared by all yt-dlp invocations. */
function commonArgs(): string[] {
  const args: string[] = ["--js-runtimes", "node", "--remote-components", "ejs:github"];
  if (COOKIES_PATH && fs.existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
  }
  return args;
}

export type YtdlpMeta = {
  title: string;
  duration: number | null;
  thumbnail: string | null;
  description: string | null;
  tags: string[];
};

export async function fetchYtdlpMeta(url: string): Promise<YtdlpMeta> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      YTDLP_PATH,
      [...commonArgs(), "--dump-json", "--no-playlist", "--", url],
      { timeout: 20_000 },
    ));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throwIfCookieError(msg);
    throw err;
  }
  const data = JSON.parse(stdout);

  // yt-dlp returns tags and categories as separate arrays — merge them.
  const rawTags: unknown[] = Array.isArray(data.tags) ? data.tags : [];
  const rawCats: unknown[] = Array.isArray(data.categories) ? data.categories : [];
  const tags = Array.from(new Set([...rawTags, ...rawCats].map(String).filter(Boolean)));

  return {
    title: data.title ?? "Unknown title",
    duration: data.duration ?? null,
    thumbnail: data.thumbnail ?? null,
    description: data.description ?? null,
    tags,
  };
}

export type YtSearchResult = {
  id: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  channel: string | null;
  view_count: number | null;
  url: string;
};

export async function searchYoutube(query: string, limit = 20): Promise<YtSearchResult[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      YTDLP_PATH,
      [...commonArgs(), "--flat-playlist", "--dump-json", "--", `ytsearch${limit}:${query}`],
      { timeout: 30_000 },
    ));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throwIfCookieError(msg);
    throw err;
  }
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const d = JSON.parse(line);
      const thumb =
        d.thumbnail ??
        (Array.isArray(d.thumbnails) && d.thumbnails.length > 0
          ? d.thumbnails[d.thumbnails.length - 1]?.url
          : null);
      return {
        id: String(d.id),
        title: d.title ?? "Unknown",
        duration: d.duration ?? null,
        thumbnail: thumb ?? null,
        channel: d.channel ?? d.uploader ?? null,
        view_count: d.view_count ?? null,
        url: d.webpage_url ?? `https://www.youtube.com/watch?v=${d.id}`,
      };
    });
}

export async function resolveYtdlpUrl(url: string): Promise<string> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      YTDLP_PATH,
      [...commonArgs(), "-g", "--no-playlist", "-f", FORMAT, "--", url],
      { timeout: 15_000 },
    ));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throwIfCookieError(msg);
    throw err;
  }
  const lines = stdout.trim().split("\n").filter(Boolean);
  if (!lines.length) throw new Error("yt-dlp returned no URL");
  return lines[0];
}

/** Parse a flat playlist (all entries one JSON object per line). */
export type YtdlpFlatEntry = {
  id?: string;
  title?: string;
  url?: string;
  webpage_url?: string;
  thumbnail?: string;
  duration?: number;
};

export async function dumpFlatPlaylist(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<YtdlpFlatEntry[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      YTDLP_PATH,
      [...commonArgs(), "--flat-playlist", "--dump-json", "--", url],
      { timeout: opts.timeoutMs ?? 180_000, maxBuffer: 100 * 1024 * 1024 },
    ));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throwIfCookieError(msg);
    throw err;
  }
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as YtdlpFlatEntry);
}

/** Get the args needed to spawn yt-dlp directly (e.g. for streaming download). */
export function ytdlpSpawnArgs(): string[] {
  return commonArgs();
}

/** Path to the yt-dlp binary. Useful when you need to spawn yt-dlp yourself. */
export function ytdlpBinaryPath(): string {
  return YTDLP_PATH;
}
