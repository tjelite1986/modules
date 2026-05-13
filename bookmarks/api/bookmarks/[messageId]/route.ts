import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: { messageId: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND message_id = ?').run(user.id, parseInt(params.messageId));

  return NextResponse.json({ ok: true });
}
