-- File-upload-storage module schema
-- folder_config — for custom folders and autoshare config
-- (the autoshare fields are used by the auto-share-folder-watcher module)

CREATE TABLE IF NOT EXISTS folder_config (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  autoshare_channel_id INTEGER,
  autoshare_user_id INTEGER,
  position INTEGER DEFAULT 99,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
