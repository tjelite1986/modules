import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/unread — unread count per channel (for sidebar badges)
export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const db = getDb();

  const rows = db.prepare(`
    SELECT c.id as channel_id,
      COUNT(m.id) as unread
    FROM channels c
    LEFT JOIN messages m ON m.channel_id = c.id
      AND m.user_id != ?
      AND m.created_at > COALESCE(
        (SELECT last_read_at FROM channel_reads WHERE user_id = ? AND channel_id = c.id),
        '1970-01-01'
      )
    WHERE c.is_dm = 0
       OR c.id IN (SELECT channel_id FROM channel_members WHERE user_id = ?)
    GROUP BY c.id
    HAVING unread > 0
  `).all(user.id, user.id, user.id) as any[];

  const result: Record<number, number> = {};
  for (const row of rows) result[row.channel_id] = row.unread;
  return NextResponse.json(result);
}

// POST /api/unread — mark channel as read
export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { channelId } = await req.json();
  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 });
  const db = getDb();
  db.prepare(`
    INSERT INTO channel_reads (user_id, channel_id, last_read_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, channel_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
  `).run(user.id, channelId);
  return NextResponse.json({ ok: true });
}
