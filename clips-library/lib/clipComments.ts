import { getDb } from "./db";
import { LIBRARIES, type LibraryKey } from "./libraries";

export interface ClipComment {
  id: number;
  slug: string;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

interface CommentRow {
  id: number;
  slug: string;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
  edited_at: string | null;
}

function table(library: LibraryKey) {
  return LIBRARIES[library].tables.comments;
}

export function listClipComments(slug: string, library: LibraryKey = "clips"): ClipComment[] {
  const db = getDb();
  const t = table(library);
  const rows = db
    .prepare(
      `SELECT c.id, c.slug, c.user_id, u.username, c.content, c.created_at, c.edited_at
       FROM ${t} c
       JOIN users u ON u.id = c.user_id
       WHERE c.slug = ?
       ORDER BY c.created_at DESC, c.id DESC`,
    )
    .all(slug) as CommentRow[];
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    userId: r.user_id,
    username: r.username,
    content: r.content,
    createdAt: r.created_at,
    editedAt: r.edited_at,
  }));
}

export function addClipComment(
  slug: string,
  userId: number,
  content: string,
  library: LibraryKey = "clips",
): ClipComment {
  const db = getDb();
  const t = table(library);
  const trimmed = content.trim();
  const info = db
    .prepare(`INSERT INTO ${t} (slug, user_id, content) VALUES (?, ?, ?)`)
    .run(slug, userId, trimmed);
  const row = db
    .prepare(
      `SELECT c.id, c.slug, c.user_id, u.username, c.content, c.created_at, c.edited_at
       FROM ${t} c JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
    )
    .get(info.lastInsertRowid) as CommentRow;
  return {
    id: row.id,
    slug: row.slug,
    userId: row.user_id,
    username: row.username,
    content: row.content,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

export function deleteClipComment(
  id: number,
  userId: number,
  isAdmin: boolean,
  library: LibraryKey = "clips",
): boolean {
  const db = getDb();
  const t = table(library);
  const row = db
    .prepare(`SELECT user_id FROM ${t} WHERE id = ?`)
    .get(id) as { user_id: number } | undefined;
  if (!row) return false;
  if (!isAdmin && row.user_id !== userId) return false;
  db.prepare(`DELETE FROM ${t} WHERE id = ?`).run(id);
  return true;
}

export function getCommentCounts(library: LibraryKey = "clips"): Map<string, number> {
  const db = getDb();
  const t = table(library);
  const rows = db
    .prepare(`SELECT slug, COUNT(*) AS n FROM ${t} GROUP BY slug`)
    .all() as Array<{ slug: string; n: number }>;
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.slug, r.n);
  return out;
}

export function getCommentCount(slug: string, library: LibraryKey = "clips"): number {
  const db = getDb();
  const t = table(library);
  return (db
    .prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE slug = ?`)
    .get(slug) as { n: number }).n;
}
