-- Active Instagram profiles tracked by Elite. Mirrors `tiktok_profiles` so
-- the management UI looks/behaves the same. The actual scraped media still
-- lives at `/photos/<username>/<file>` (PHOTOS_ROOT in lib/photos.ts) so
-- existing /photos viewer + /feed Discover-tab keep working unchanged.
CREATE TABLE IF NOT EXISTS instagram_profiles (
  username        TEXT PRIMARY KEY,
  display_name    TEXT,
  bio             TEXT,
  avatar_url      TEXT,
  post_count      INTEGER,
  added_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_synced_at  DATETIME,
  last_sync_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_instagram_profiles_added ON instagram_profiles(added_at DESC);
