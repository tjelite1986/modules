import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const comments = db.prepare(`
    SELECT c.id, c.post_id, c.content, c.created_at,
      COALESCE(u.display_name, u.username) AS display_name,
      u.username, u.avatar, u.id AS user_id
    FROM post_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(params.id);

  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)'
  ).run(params.id, user.id, content.trim());

  const comment = db.prepare(`
    SELECT c.id, c.post_id, c.content, c.created_at,
      COALESCE(u.display_name, u.username) AS display_name,
      u.username, u.avatar, u.id AS user_id
    FROM post_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  const io = (global as any)._io;
  if (io) io.emit('feed-post-commented', { postId: Number(params.id), comment });

  return NextResponse.json(comment);
}
