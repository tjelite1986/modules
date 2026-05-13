-- The import route writes into a `media` table with this minimal shape.
-- If your schema differs, adapt the INSERT in api/import-playlist.ts.

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'video',
  url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  category TEXT,
  needs_ytdlp INTEGER NOT NULL DEFAULT 0,
  is_adult INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
