import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const channelId = parseInt(params.id);
  const db = getDb();
  const rows = db.prepare(
    'SELECT user_id, last_read_message_id, read_at FROM dm_read WHERE channel_id = ?'
  ).all(channelId) as any[];

  return NextResponse.json(rows.map(r => ({
    userId: r.user_id,
    lastReadMessageId: r.last_read_message_id,
    readAt: r.read_at,
  })));
}
