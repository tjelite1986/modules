import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const existing = db.prepare(
    'SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?'
  ).get(params.id, user.id);

  if (existing) {
    db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(params.id, user.id);
  } else {
    db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').run(params.id, user.id);
  }

  const { count } = db.prepare(
    'SELECT COUNT(*) AS count FROM post_likes WHERE post_id = ?'
  ).get(params.id) as any;

  const io = (global as any)._io;
  if (io) io.emit('feed-post-liked', { id: Number(params.id), likeCount: count, likedBy: user.id, liked: !existing });

  return NextResponse.json({ liked: !existing, likeCount: count });
}
