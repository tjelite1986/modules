import { getDb } from "./db";

export interface TiktokStats {
  likes: number;
  views: number;
}

export function getTiktokStats(videoId: string): TiktokStats {
  const db = getDb();
  const likes = (db.prepare("SELECT COUNT(*) AS n FROM tiktok_likes WHERE video_id = ?")
    .get(videoId) as { n: number }).n;
  const views = (db.prepare("SELECT COUNT(*) AS n FROM tiktok_views WHERE video_id = ?")
    .get(videoId) as { n: number }).n;
  return { likes, views };
}

export function getAllTiktokStats(usernames?: string[]): Map<string, TiktokStats> {
  const db = getDb();
  const out = new Map<string, TiktokStats>();
  if (usernames && usernames.length === 0) return out;

  const ids = usernames
    ? (db.prepare(
        `SELECT video_id FROM tiktok_videos WHERE username IN (${usernames.map(() => "?").join(",")})`,
      ).all(...usernames) as { video_id: string }[]).map((r) => r.video_id)
    : null;

  const likeRows = ids
    ? (db.prepare(
        `SELECT video_id, COUNT(*) AS n FROM tiktok_likes WHERE video_id IN (${ids.map(() => "?").join(",")}) GROUP BY video_id`,
      ).all(...ids) as Array<{ video_id: string; n: number }>)
    : (db.prepare("SELECT video_id, COUNT(*) AS n FROM tiktok_likes GROUP BY video_id")
        .all() as Array<{ video_id: string; n: number }>);
  for (const r of likeRows) out.set(r.video_id, { likes: r.n, views: 0 });

  const viewRows = ids
    ? (db.prepare(
        `SELECT video_id, COUNT(*) AS n FROM tiktok_views WHERE video_id IN (${ids.map(() => "?").join(",")}) GROUP BY video_id`,
      ).all(...ids) as Array<{ video_id: string; n: number }>)
    : (db.prepare("SELECT video_id, COUNT(*) AS n FROM tiktok_views GROUP BY video_id")
        .all() as Array<{ video_id: string; n: number }>);
  for (const r of viewRows) {
    const cur = out.get(r.video_id) ?? { likes: 0, views: 0 };
    cur.views = r.n;
    out.set(r.video_id, cur);
  }
  return out;
}

export function getUserLikedTiktokIds(userId: number): Set<string> {
  const db = getDb();
  const rows = db.prepare("SELECT video_id FROM tiktok_likes WHERE user_id = ?")
    .all(userId) as Array<{ video_id: string }>;
  return new Set(rows.map((r) => r.video_id));
}

export function setTiktokLike(userId: number, videoId: string, liked: boolean): void {
  const db = getDb();
  if (liked) {
    db.prepare("INSERT OR IGNORE INTO tiktok_likes (user_id, video_id) VALUES (?, ?)")
      .run(userId, videoId);
  } else {
    db.prepare("DELETE FROM tiktok_likes WHERE user_id = ? AND video_id = ?")
      .run(userId, videoId);
  }
}

export function recordTiktokView(userId: number, videoId: string): void {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO tiktok_views (user_id, video_id) VALUES (?, ?)")
    .run(userId, videoId);
}
