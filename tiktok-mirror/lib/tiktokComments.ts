import { getDb } from "./db";

export interface TiktokComment {
  id: number;
  videoId: string;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

interface CommentRow {
  id: number;
  video_id: string;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
  edited_at: string | null;
}

export function listTiktokComments(videoId: string): TiktokComment[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT c.id, c.video_id, c.user_id, u.username, c.content, c.created_at, c.edited_at
     FROM tiktok_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.video_id = ?
     ORDER BY c.created_at DESC, c.id DESC`,
  ).all(videoId) as CommentRow[];
  return rows.map((r) => ({
    id: r.id,
    videoId: r.video_id,
    userId: r.user_id,
    username: r.username,
    content: r.content,
    createdAt: r.created_at,
    editedAt: r.edited_at,
  }));
}

export function addTiktokComment(videoId: string, userId: number, content: string): TiktokComment {
  const db = getDb();
  const trimmed = content.trim();
  const info = db.prepare(
    "INSERT INTO tiktok_comments (video_id, user_id, content) VALUES (?, ?, ?)",
  ).run(videoId, userId, trimmed);
  const row = db.prepare(
    `SELECT c.id, c.video_id, c.user_id, u.username, c.content, c.created_at, c.edited_at
     FROM tiktok_comments c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
  ).get(info.lastInsertRowid) as CommentRow;
  return {
    id: row.id,
    videoId: row.video_id,
    userId: row.user_id,
    username: row.username,
    content: row.content,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

export function deleteTiktokComment(id: number, userId: number, isAdmin: boolean): boolean {
  const db = getDb();
  const row = db.prepare("SELECT user_id FROM tiktok_comments WHERE id = ?")
    .get(id) as { user_id: number } | undefined;
  if (!row) return false;
  if (!isAdmin && row.user_id !== userId) return false;
  db.prepare("DELETE FROM tiktok_comments WHERE id = ?").run(id);
  return true;
}

export function getTiktokCommentCount(videoId: string): number {
  const db = getDb();
  return (db.prepare("SELECT COUNT(*) AS n FROM tiktok_comments WHERE video_id = ?")
    .get(videoId) as { n: number }).n;
}

export function getTiktokCommentCounts(usernames?: string[]): Map<string, number> {
  const db = getDb();
  const out = new Map<string, number>();
  if (usernames && usernames.length === 0) return out;
  const rows = usernames
    ? (db.prepare(
        `SELECT c.video_id, COUNT(*) AS n FROM tiktok_comments c
         JOIN tiktok_videos v ON v.video_id = c.video_id
         WHERE v.username IN (${usernames.map(() => "?").join(",")})
         GROUP BY c.video_id`,
      ).all(...usernames) as Array<{ video_id: string; n: number }>)
    : (db.prepare("SELECT video_id, COUNT(*) AS n FROM tiktok_comments GROUP BY video_id")
        .all() as Array<{ video_id: string; n: number }>);
  for (const r of rows) out.set(r.video_id, r.n);
  return out;
}
