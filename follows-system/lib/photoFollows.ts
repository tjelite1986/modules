import { getDb } from "./db";

export function followProfile(userId: number, profile: string): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO photo_profile_follows (user_id, profile) VALUES (?, ?)",
  ).run(userId, profile);
}

export function unfollowProfile(userId: number, profile: string): void {
  const db = getDb();
  db.prepare(
    "DELETE FROM photo_profile_follows WHERE user_id = ? AND profile = ?",
  ).run(userId, profile);
}

export function isFollowingProfile(userId: number, profile: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT 1 AS hit FROM photo_profile_follows WHERE user_id = ? AND profile = ?",
    )
    .get(userId, profile) as { hit: number } | undefined;
  return !!row;
}

export function listFollowedProfiles(userId: number): Set<string> {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT profile FROM photo_profile_follows WHERE user_id = ? ORDER BY created_at DESC",
    )
    .all(userId) as Array<{ profile: string }>;
  return new Set(rows.map((r) => r.profile));
}
