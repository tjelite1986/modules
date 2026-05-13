import { getDb } from "./db";

export interface Story {
  id: number;
  user_id: number;
  username: string;
  display_name: string | null;
  avatar: string | null;
  media_url: string;
  media_type: string | null;
  caption: string | null;
  source_kind: string | null;
  source_ref: string | null;
  created_at: string;
  expires_at: string;
  view_count: number;
  viewed_by_me: number | boolean;
}

export interface StoryUserGroup {
  user_id: number;
  username: string;
  display_name: string | null;
  avatar: string | null;
  story_count: number;
  latest_at: string;
  has_unviewed: number | boolean;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

export function purgeExpiredStories(): void {
  const db = getDb();
  db.prepare("DELETE FROM stories WHERE expires_at <= datetime('now')").run();
}

export function createStory(
  userId: number,
  input: {
    mediaUrl: string;
    mediaType?: string | null;
    caption?: string | null;
    sourceKind?: string | null;
    sourceRef?: string | null;
    ttlSeconds?: number;
  },
): Story | null {
  const db = getDb();
  const ttl = Math.max(60, Math.min(input.ttlSeconds ?? DEFAULT_TTL_SECONDS, 7 * 24 * 60 * 60));
  const result = db
    .prepare(
      `INSERT INTO stories (user_id, media_url, media_type, caption, source_kind, source_ref, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))`,
    )
    .run(
      userId,
      input.mediaUrl,
      input.mediaType ?? null,
      input.caption?.trim() || null,
      input.sourceKind ?? null,
      input.sourceRef ?? null,
      ttl,
    );
  return getStory(userId, Number(result.lastInsertRowid));
}

export function getStory(viewerId: number, storyId: number): Story | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.source_kind, s.source_ref,
              s.created_at, s.expires_at,
              u.username, COALESCE(u.display_name, u.username) AS display_name, u.avatar,
              (SELECT COUNT(*) FROM story_views v WHERE v.story_id = s.id) AS view_count,
              EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.user_id = ?) AS viewed_by_me
         FROM stories s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > datetime('now')`,
    )
    .get(viewerId, storyId) as Story | undefined;
  return row ?? null;
}

export function listActiveStoryGroups(viewerId: number): StoryUserGroup[] {
  purgeExpiredStories();
  const db = getDb();
  return db
    .prepare(
      `SELECT s.user_id,
              u.username,
              COALESCE(u.display_name, u.username) AS display_name,
              u.avatar,
              COUNT(*) AS story_count,
              MAX(s.created_at) AS latest_at,
              EXISTS(
                SELECT 1 FROM stories s2
                 WHERE s2.user_id = s.user_id
                   AND s2.expires_at > datetime('now')
                   AND NOT EXISTS(
                     SELECT 1 FROM story_views v
                      WHERE v.story_id = s2.id AND v.user_id = ?
                   )
              ) AS has_unviewed
         FROM stories s
         JOIN users u ON u.id = s.user_id
        WHERE s.expires_at > datetime('now')
        GROUP BY s.user_id, u.username, u.display_name, u.avatar
        ORDER BY has_unviewed DESC, latest_at DESC`,
    )
    .all(viewerId) as StoryUserGroup[];
}

export function listStoriesForUser(viewerId: number, userId: number): Story[] {
  purgeExpiredStories();
  const db = getDb();
  return db
    .prepare(
      `SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.source_kind, s.source_ref,
              s.created_at, s.expires_at,
              u.username, COALESCE(u.display_name, u.username) AS display_name, u.avatar,
              (SELECT COUNT(*) FROM story_views v WHERE v.story_id = s.id) AS view_count,
              EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.user_id = ?) AS viewed_by_me
         FROM stories s
         JOIN users u ON u.id = s.user_id
        WHERE s.user_id = ? AND s.expires_at > datetime('now')
        ORDER BY s.created_at ASC, s.id ASC`,
    )
    .all(viewerId, userId) as Story[];
}

export function markStoryViewed(viewerId: number, storyId: number): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO story_views (story_id, user_id) VALUES (?, ?)",
  ).run(storyId, viewerId);
}

export function deleteStory(userId: number, storyId: number): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM stories WHERE id = ? AND user_id = ?")
    .run(storyId, userId);
  return result.changes > 0;
}
