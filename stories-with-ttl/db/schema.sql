-- Cross-feature sharing and ephemeral stories.
-- gallery_item_shares: share token per gallery item, used when posting an
-- item to feed/chat/story so the recipient (any logged-in user) can view it
-- without owning the source item.
CREATE TABLE IF NOT EXISTS gallery_item_shares (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id      INTEGER NOT NULL,
  share_token  TEXT NOT NULL UNIQUE,
  created_by   INTEGER NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id)    REFERENCES gallery_items(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)         ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gallery_item_shares_item ON gallery_item_shares(item_id);

-- 24h ephemeral stories per user. media_url is a URL the viewer can fetch
-- (typically /api/gallery/shared/<token> for gallery sources, or a direct
-- /uploads/... path for ad-hoc uploads).
CREATE TABLE IF NOT EXISTS stories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  media_url    TEXT NOT NULL,
  media_type   TEXT,
  caption      TEXT,
  source_kind  TEXT,
  source_ref   TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stories_active   ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_user     ON stories(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS story_views (
  story_id  INTEGER NOT NULL,
  user_id   INTEGER NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (story_id, user_id),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE
);
