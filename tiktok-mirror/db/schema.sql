CREATE TABLE IF NOT EXISTS tiktok_profiles (
  username        TEXT    PRIMARY KEY,
  display_name    TEXT,
  avatar_path     TEXT,
  last_synced_at  DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tiktok_videos (
  video_id        TEXT    PRIMARY KEY,
  username        TEXT    NOT NULL,
  url             TEXT    NOT NULL,
  title           TEXT,
  description     TEXT,
  duration        INTEGER,
  upload_date     TEXT,
  thumbnail_path  TEXT,
  video_path      TEXT,
  downloaded_at   DATETIME,
  last_watched_at DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (username) REFERENCES tiktok_profiles(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tiktok_videos_username ON tiktok_videos(username);
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_created_at ON tiktok_videos(created_at);
CREATE TABLE IF NOT EXISTS tiktok_likes (
  user_id    INTEGER NOT NULL,
  video_id   TEXT    NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, video_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tiktok_likes_video_id ON tiktok_likes(video_id);

CREATE TABLE IF NOT EXISTS tiktok_views (
  user_id   INTEGER NOT NULL,
  video_id  TEXT    NOT NULL,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, video_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tiktok_views_video_id ON tiktok_views(video_id);

CREATE TABLE IF NOT EXISTS tiktok_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id   TEXT    NOT NULL,
  user_id    INTEGER NOT NULL,
  content    TEXT    NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  edited_at  DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tiktok_comments_video_id ON tiktok_comments(video_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_comments_user_id ON tiktok_comments(user_id);
