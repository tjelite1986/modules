import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const sessionId = parseInt(params.id);
  const session = db.prepare('SELECT user_id FROM sessions WHERE id = ?').get(sessionId) as any;

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  return NextResponse.json({ ok: true });
}
