import { getDb } from "./db";

/** Returns true if the relation was newly created (false if already followed). */
export function follow(followerId: number, followingId: number): boolean {
  if (followerId === followingId) return false;
  const db = getDb();
  const result = db
    .prepare(
      "INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)",
    )
    .run(followerId, followingId);
  return result.changes > 0;
}

export function unfollow(followerId: number, followingId: number): void {
  const db = getDb();
  db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").run(
    followerId,
    followingId,
  );
}

export function isFollowing(followerId: number, followingId: number): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT 1 AS x FROM follows WHERE follower_id = ? AND following_id = ?")
    .get(followerId, followingId) as { x: number } | undefined;
  return !!row;
}

export function followersCount(userId: number): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM follows WHERE following_id = ?")
    .get(userId) as { c: number };
  return row.c;
}

export function followingCount(userId: number): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?")
    .get(userId) as { c: number };
  return row.c;
}

export interface FollowUserRow {
  id: number;
  username: string;
}

export function listFollowers(userId: number, limit = 100): FollowUserRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT u.id, u.username
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ?
       ORDER BY f.created_at DESC
       LIMIT ?`,
    )
    .all(userId, limit) as FollowUserRow[];
}

export function listFollowing(userId: number, limit = 100): FollowUserRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT u.id, u.username
       FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ?
       ORDER BY f.created_at DESC
       LIMIT ?`,
    )
    .all(userId, limit) as FollowUserRow[];
}
