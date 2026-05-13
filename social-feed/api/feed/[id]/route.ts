import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(params.id) as any;
  if (!post) return NextResponse.json({ error: 'Does not exist' }, { status: 404 });

  const me = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(user.id) as any;
  if (post.user_id !== user.id && !me?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  db.prepare('DELETE FROM post_likes WHERE post_id = ?').run(params.id);
  db.prepare('DELETE FROM post_comments WHERE post_id = ?').run(params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(params.id);

  const io = (global as any)._io;
  if (io) io.emit('feed-post-deleted', { id: Number(params.id) });

  return NextResponse.json({ ok: true });
}
