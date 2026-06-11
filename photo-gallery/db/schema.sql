-- Personal gallery (Google Photos style): user-owned images and videos with
-- timeline, albums, favorites, soft-delete trash and optional album sharing.

CREATE TABLE IF NOT EXISTS gallery_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  filename        TEXT NOT NULL,
  storage_key     TEXT NOT NULL UNIQUE,
  kind            TEXT NOT NULL CHECK (kind IN ('image','video')),
  mime_type       TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  width           INTEGER,
  height          INTEGER,
  duration_ms     INTEGER,
  taken_at        DATETIME NOT NULL,
  uploaded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  thumbnail_ready INTEGER NOT NULL DEFAULT 0,
  preview_ready   INTEGER NOT NULL DEFAULT 0,
  is_favorite     INTEGER NOT NULL DEFAULT 0,
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  deleted_at      DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gallery_items_user_taken
  ON gallery_items(user_id, is_deleted, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_gallery_items_user_favorite
  ON gallery_items(user_id, is_favorite, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_gallery_items_user_deleted
  ON gallery_items(user_id, is_deleted, deleted_at DESC);

CREATE TABLE IF NOT EXISTS gallery_albums (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  cover_item_id INTEGER,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)       REFERENCES users(id)         ON DELETE CASCADE,
  FOREIGN KEY (cover_item_id) REFERENCES gallery_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_albums_user
  ON gallery_albums(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS gallery_album_items (
  album_id INTEGER NOT NULL,
  item_id  INTEGER NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (album_id, item_id),
  FOREIGN KEY (album_id) REFERENCES gallery_albums(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id)  REFERENCES gallery_items(id)  ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gallery_album_items_item
  ON gallery_album_items(item_id);

CREATE TABLE IF NOT EXISTS gallery_tags (
  item_id INTEGER NOT NULL,
  tag     TEXT NOT NULL,
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES gallery_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gallery_tags_tag ON gallery_tags(tag);

CREATE TABLE IF NOT EXISTS gallery_album_shares (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id    INTEGER NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME,
  FOREIGN KEY (album_id) REFERENCES gallery_albums(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gallery_album_shares_album
  ON gallery_album_shares(album_id);
ALTER TABLE gallery_items ADD COLUMN description TEXT;
ALTER TABLE gallery_items ADD COLUMN latitude REAL;
ALTER TABLE gallery_items ADD COLUMN longitude REAL;
ALTER TABLE gallery_items ADD COLUMN location_name TEXT;
-- Cache-busting version for derived media (thumb/preview); bumped on rotate
-- and HEIF repair so immutable-cached URLs change.
ALTER TABLE gallery_items ADD COLUMN media_version INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_gallery_items_geo ON gallery_items(latitude, longitude);
CREATE TABLE IF NOT EXISTS gallery_trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT,
  cover_item_id INTEGER,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gallery_trips_user ON gallery_trips(user_id);

CREATE TABLE IF NOT EXISTS gallery_trip_items (
  trip_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  PRIMARY KEY (trip_id, item_id),
  FOREIGN KEY (trip_id) REFERENCES gallery_trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gallery_trip_items_item ON gallery_trip_items(item_id);
CREATE TABLE IF NOT EXISTS gallery_trip_name_rules (
  user_id INTEGER NOT NULL,
  auto_title TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, auto_title)
);
ALTER TABLE gallery_items ADD COLUMN content_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_items_user_hash
  ON gallery_items(user_id, content_hash)
  WHERE content_hash IS NOT NULL;
-- Per-item star rating (0-5). 0 means unrated.
ALTER TABLE gallery_items ADD COLUMN rating INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_gallery_items_user_rating
  ON gallery_items(user_id, rating, taken_at DESC);
-- Smart albums: saved filter combinations rendered as dynamic albums.
CREATE TABLE IF NOT EXISTS gallery_smart_albums (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  name       TEXT NOT NULL,
  filters    TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gallery_smart_albums_user
  ON gallery_smart_albums(user_id, updated_at DESC);
-- Custom ordering of items in albums. NULL means "fall back to taken_at sort".
ALTER TABLE gallery_album_items ADD COLUMN position INTEGER;

CREATE INDEX IF NOT EXISTS idx_gallery_album_items_album_position
  ON gallery_album_items(album_id, position);
