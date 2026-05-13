-- Live-chat module schema
-- Requires: authentication module (users), and a channels table.
--
-- If you don't have a channels module, add this minimal version:
-- CREATE TABLE IF NOT EXISTS channels (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   name TEXT UNIQUE NOT NULL,
--   description TEXT,
--   created_by INTEGER,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   is_dm INTEGER DEFAULT 0
-- );

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  file_name TEXT,
  file_size INTEGER,
  reply_to INTEGER,
  expires_at DATETIME,
  edited_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES channels(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON messages(channel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reactions (
  message_id INTEGER,
  user_id INTEGER,
  emoji TEXT,
  PRIMARY KEY (message_id, user_id, emoji)
);
