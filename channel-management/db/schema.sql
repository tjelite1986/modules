-- Channel-management module schema
-- Requires: authentication module (users table)

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  banner TEXT,
  icon TEXT,
  created_by INTEGER,
  is_dm INTEGER DEFAULT 0,
  category_id INTEGER REFERENCES categories(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id INTEGER,
  user_id INTEGER,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (channel_id, user_id)
);

-- Default category if none exists
INSERT OR IGNORE INTO categories (name, position) VALUES ('General', 0);

-- Default channel if none exists
INSERT OR IGNORE INTO channels (name, description, is_dm) VALUES ('general', 'General discussion', 0);
