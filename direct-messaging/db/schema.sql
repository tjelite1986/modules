-- Direct-messaging module schema
-- Requires: authentication (users), channel-management (channels, channel_members), live-chat (messages)

-- DM-specific read tracking (lastReadMessageId per user per DM)
CREATE TABLE IF NOT EXISTS dm_read (
  channel_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_read_message_id INTEGER NOT NULL DEFAULT 0,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (channel_id, user_id)
);

-- General channel-read tracking (for unread counter on all channels)
CREATE TABLE IF NOT EXISTS channel_reads (
  user_id INTEGER,
  channel_id INTEGER,
  last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, channel_id)
);
