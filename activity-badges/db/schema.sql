CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_global ON activity(created_at DESC);

CREATE TABLE IF NOT EXISTS badges_earned (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge_key TEXT NOT NULL,
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, badge_key)
);
CREATE INDEX IF NOT EXISTS idx_badges_user ON badges_earned(user_id);
