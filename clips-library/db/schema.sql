CREATE TABLE IF NOT EXISTS clip_likes (
  user_id    INTEGER NOT NULL,
  slug       TEXT    NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clip_likes_slug ON clip_likes(slug);

CREATE TABLE IF NOT EXISTS clip_views (
  user_id   INTEGER NOT NULL,
  slug      TEXT    NOT NULL,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clip_views_slug ON clip_views(slug);
CREATE TABLE IF NOT EXISTS clip_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT    NOT NULL,
  user_id    INTEGER NOT NULL,
  content    TEXT    NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  edited_at  DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clip_comments_slug ON clip_comments(slug, created_at);

-- Unified profile registry. A clip profile is one folder under CLIPS_ROOT
-- containing videos plus optional metadata. Profiles created by manual
-- drop-in get auto_poll=0 and source_url=NULL. Profiles backed by a
-- remote feed (TikTok / Instagram / etc via yt-dlp) get auto_poll=1
-- and source_url set to the user/profile URL. videos_limit caps how
-- many of the most recent videos yt-dlp considers when polling
-- (NULL = use DEFAULT_PROFILE_VIDEOS_LIMIT in lib/clipsSync.ts).
CREATE TABLE IF NOT EXISTS clip_profiles (
  name            TEXT    PRIMARY KEY,
  display_name    TEXT,
  source_url      TEXT,
  source_kind     TEXT,
  auto_poll       INTEGER NOT NULL DEFAULT 0,
  videos_limit    INTEGER,
  last_synced_at  DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clip_profiles_auto_poll
  ON clip_profiles(auto_poll, last_synced_at);

-- Videos the user has explicitly removed from a profile. The auto-poll
-- sync uses this list to avoid re-downloading what was just deleted.
CREATE TABLE IF NOT EXISTS clip_profile_skipped (
  profile     TEXT NOT NULL,
  video_id    TEXT NOT NULL,
  deleted_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile, video_id),
  FOREIGN KEY (profile) REFERENCES clip_profiles(name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clip_profile_skipped_profile
  ON clip_profile_skipped(profile);
