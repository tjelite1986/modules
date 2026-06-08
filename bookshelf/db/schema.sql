-- Shared bookshelf: catalogue (books) + per-user reading position.
-- Files live on disk under STORE_ROOT/books/. The catalogue is the source
-- of truth for what's available; FS scan on startup upserts entries so
-- admins can drop files in directly without using the upload UI.

CREATE TABLE IF NOT EXISTS books (
  slug         TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  author       TEXT,
  format       TEXT NOT NULL CHECK (format IN ('epub', 'pdf', 'cbz')),
  file_path    TEXT NOT NULL,
  cover_path   TEXT,
  size_bytes   INTEGER,
  page_count   INTEGER,
  added_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  added_by     INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_books_added ON books(added_at DESC);

CREATE TABLE IF NOT EXISTS book_reading_state (
  book_slug    TEXT    NOT NULL,
  user_id      INTEGER NOT NULL,
  -- EPUB: a CFI string. PDF/CBZ: a page number serialised as text.
  position     TEXT,
  percent      INTEGER NOT NULL DEFAULT 0,
  last_read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at  DATETIME,
  PRIMARY KEY (book_slug, user_id),
  FOREIGN KEY (book_slug) REFERENCES books(slug) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_book_reading_state_user
  ON book_reading_state(user_id, last_read_at DESC);
