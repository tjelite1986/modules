import type Database from "better-sqlite3";
import { dumpFlatPlaylist, type YtdlpFlatEntry } from "@/lib/ytdlp";
import { isYouTubeUrl } from "@/lib/media";

export type ImportResult = {
  imported: number;
  total: number;
  errors: string[];
};

/** Build a playable URL from a flat-playlist entry. */
export function buildEntryUrl(entry: YtdlpFlatEntry, sourceUrl: string): string | null {
  if (entry.url && entry.url.startsWith("http")) return entry.url;
  if (entry.webpage_url) return entry.webpage_url;
  if (entry.id && isYouTubeUrl(sourceUrl)) {
    return `https://www.youtube.com/watch?v=${entry.id}`;
  }
  return null;
}

/** Pick the best thumbnail URL for a flat-playlist entry. */
export function pickEntryThumbnail(
  entry: YtdlpFlatEntry,
  videoUrl: string,
): string | null {
  if (entry.thumbnail) return entry.thumbnail;
  if (isYouTubeUrl(videoUrl) && entry.id) {
    return `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
  }
  return null;
}

interface ImportOptions {
  /** Optional category to assign to all imported items. */
  category?: string | null;
  /** Mark as adult/restricted content. */
  isAdult?: boolean;
}

/**
 * Import every entry from a yt-dlp-supported playlist URL into a `media` table.
 * Runs the inserts in a single transaction. Returns a per-item summary.
 *
 * The `media` table is expected to have at minimum these columns (see schema.sql):
 *   title, type, url, thumbnail_url, duration, category, needs_ytdlp, is_adult
 *
 * Adapt the INSERT below if your schema differs.
 */
export async function importPlaylist(
  db: Database.Database,
  playlistUrl: string,
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const entries = await dumpFlatPlaylist(playlistUrl);
  if (entries.length === 0) {
    return { imported: 0, total: 0, errors: ["No videos found in the playlist"] };
  }

  let imported = 0;
  const errors: string[] = [];

  const insert = db.prepare(`
    INSERT INTO media (title, type, url, thumbnail_url, duration, category, needs_ytdlp, is_adult)
    VALUES (?, 'video', ?, ?, ?, ?, ?, ?)
  `);

  const importMany = db.transaction(() => {
    for (const entry of entries) {
      try {
        const videoUrl = buildEntryUrl(entry, playlistUrl);
        if (!videoUrl) {
          errors.push(`No URL for: ${entry.title || entry.id || "unknown"}`);
          continue;
        }

        const needsYtdlp = isYouTubeUrl(videoUrl) ? 0 : 1;
        const thumbnail = pickEntryThumbnail(entry, videoUrl);
        const duration = entry.duration ? Math.round(entry.duration) : null;
        const title = entry.title || videoUrl;

        insert.run(
          title,
          videoUrl,
          thumbnail,
          duration,
          opts.category ?? null,
          needsYtdlp,
          opts.isAdult ? 1 : 0,
        );
        imported++;
      } catch {
        errors.push("Parse error on one entry");
      }
    }
  });

  importMany();

  return {
    imported,
    total: entries.length,
    errors: errors.slice(0, 20),
  };
}
