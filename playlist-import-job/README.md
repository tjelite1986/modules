# playlist-import-job

Bulk-import every entry of a yt-dlp-supported playlist URL (YouTube, Vimeo, anywhere yt-dlp can `--flat-playlist`) into a local `media` table. Single transaction; returns per-item counts and errors.

## What's included

- `lib/import-playlist.ts` — `importPlaylist(db, url, opts)` — pure function, no HTTP
- `api/import-playlist.ts` — `POST /api/admin/import-playlist` — admin-only HTTP endpoint
- `db/schema.sql` — minimal `media` table schema if you need one

## API

```ts
import { importPlaylist } from "@/lib/import-playlist";
import { getDb } from "@/lib/db";

const result = await importPlaylist(getDb(), "https://www.youtube.com/playlist?list=...", {
  category: "Lectures",
  isAdult: false,
});
// → { imported: 47, total: 50, errors: ["No URL for: ..."] }
```

```bash
# Or via the HTTP wrapper:
curl -X POST /api/admin/import-playlist \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/playlist?list=...","category":"Lectures"}'
```

## Required `media` table shape

```sql
media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'video',
  url           TEXT,
  thumbnail_url TEXT,
  duration      INTEGER,        -- seconds
  category      TEXT,
  needs_ytdlp   INTEGER NOT NULL DEFAULT 0,   -- 0 for YouTube, 1 for other
  is_adult      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
)
```

If your schema differs, edit the `INSERT` in `lib/import-playlist.ts`. Two helpers are exported for reuse if you write your own importer:

- `buildEntryUrl(entry, sourceUrl)` — picks `entry.url` / `entry.webpage_url` / `https://youtube.com/watch?v=<id>`
- `pickEntryThumbnail(entry, videoUrl)` — falls back to `i.ytimg.com/vi/<id>/hqdefault.jpg` for YouTube

## Sync vs async

This is a **synchronous** route — one yt-dlp call followed by one DB transaction. Fine for playlists up to a few hundred items. For larger playlists or when you want a progress UI:

1. Drop in the `background-job-template`.
2. Wrap the `importPlaylist()` call in a job, return `{ jobId }` immediately.
3. Have the client poll `GET /api/jobs/:id` for progress.

## Dependencies on other modules

- `ytdlp-wrapper` — provides `dumpFlatPlaylist` and `YtdlpCookieError`.
- `media-utils` — provides `isYouTubeUrl`.
- `auth-nextauth` — admin role check.

## Customization

- **Schema mapping** — edit the `INSERT` in `lib/import-playlist.ts` if your columns differ.
- **Per-item validation** — extend the loop in `importPlaylist` to skip duplicates (look up by `url` first), reject unknown categories, etc.
- **Re-import / overwrite** — currently always inserts. Add `INSERT ... ON CONFLICT(url) DO UPDATE` if you want upsert behaviour.
