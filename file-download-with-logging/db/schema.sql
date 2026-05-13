-- file-download-with-logging module schema
-- Logs every authenticated download. user_id is nullable because anonymous
-- downloads (if you remove the auth check) should still be logged.

CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  type TEXT NOT NULL,
  app_name TEXT NOT NULL,
  version TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
