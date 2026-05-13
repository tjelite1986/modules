/**
 * Pure utility functions for working with media URLs and metadata.
 * Zero dependencies. Safe to import from server, client, or edge.
 */

const VIDEO_AUDIO_IMAGE_EXTS =
  /\.(mp4|m4v|m4a|mp3|webm|ogg|avi|mkv|flv|mov|wav|flac|aac|jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i;

/** True if the URL points at YouTube (youtube.com, youtu.be, or youtube embed). */
export function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}

/**
 * Extract the YouTube video ID from a URL. Handles:
 *   ?v=ID    — youtube.com watch URLs
 *   youtu.be/ID
 *   /embed/ID
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [/[?&]v=([^&#]+)/, /youtu\.be\/([^?&#]+)/, /embed\/([^?&#]+)/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Build the standard hqdefault thumbnail URL for a YouTube video ID. */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** True if the URL ends in a known video/audio/image extension. */
export function isDirectMediaUrl(url: string): boolean {
  return VIDEO_AUDIO_IMAGE_EXTS.test(url);
}

/**
 * Format a number of seconds as `H:MM:SS` (or `M:SS` when under an hour).
 * Returns "" when the input is falsy.
 */
export function formatDuration(seconds?: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Format a view count in YouTube style: "1.2K views", "3.4M views".
 * Pass `viewSuffix: ""` to get just the number.
 */
export function formatViews(views: number, viewSuffix = " views"): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M${viewSuffix}`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K${viewSuffix}`;
  return `${views}${viewSuffix}`;
}

/**
 * Classify a URL into a media handler kind.
 *   - "youtube" → embeddable YouTube iframe
 *   - "direct"  → ends in .mp4 / .mp3 / etc., can be used as <video src=...> directly
 *   - "ytdlp"   → other web URL that needs yt-dlp to resolve
 *   - null      → not a URL we can play
 */
export function classifyMediaUrl(
  url: string,
): "youtube" | "direct" | "ytdlp" | null {
  if (!url) return null;
  if (isYouTubeUrl(url)) return "youtube";
  if (isDirectMediaUrl(url)) return "direct";
  if (/^https?:\/\//.test(url)) return "ytdlp";
  return null;
}
