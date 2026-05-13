-- Bookmarks module schema
-- Requires: authentication (users) + live-chat (messages)

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, message_id)
);
