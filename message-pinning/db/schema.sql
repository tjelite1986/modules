-- Message-pinning module schema
-- Requires: authentication (users), channel-management (channels), live-chat (messages)

CREATE TABLE IF NOT EXISTS pinned_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  pinned_by INTEGER NOT NULL,
  pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_id, message_id)
);
