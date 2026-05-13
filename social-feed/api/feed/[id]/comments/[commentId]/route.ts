import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const comment = db.prepare('SELECT user_id FROM post_comments WHERE id = ?').get(params.commentId) as any;
  if (!comment) return NextResponse.json({ error: 'Does not exist' }, { status: 404 });

  const me = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(user.id) as any;
  if (comment.user_id !== user.id && !me?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  db.prepare('DELETE FROM post_comments WHERE id = ?').run(params.commentId);

  const io = (global as any)._io;
  if (io) io.emit('feed-comment-deleted', { postId: Number(params.id), commentId: Number(params.commentId) });

  return NextResponse.json({ ok: true });
}
