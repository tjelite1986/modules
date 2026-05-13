CREATE TABLE IF NOT EXISTS profile_views (
  profile_user_id INTEGER NOT NULL,
  viewer_user_id INTEGER NOT NULL,
  views_count INTEGER NOT NULL DEFAULT 1,
  last_viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_user_id, viewer_user_id)
);
CREATE INDEX IF NOT EXISTS idx_profile_views_profile
  ON profile_views(profile_user_id, last_viewed_at DESC);

CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL,
  following_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
-- User-level follow relationship for scraped Instagram profiles.
-- Used by the /feed Following/Discover tabs to filter content by
-- whether the viewer follows the profile that posted it.
CREATE TABLE IF NOT EXISTS photo_profile_follows (
  user_id    INTEGER NOT NULL,
  profile    TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, profile),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_photo_profile_follows_user
  ON photo_profile_follows(user_id, created_at DESC);
