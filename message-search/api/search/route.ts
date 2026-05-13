import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const db = getDb();
  const pattern = `%${q}%`;

  const rows = db.prepare(`
    SELECT
      m.id, m.content, m.file_name, m.file_url, m.file_type,
      m.created_at, m.channel_id,
      u.username,
      c.name AS channel_name, c.is_dm
    FROM messages m
    JOIN users u ON m.user_id = u.id
    JOIN channels c ON m.channel_id = c.id
    WHERE (m.expires_at IS NULL OR m.expires_at > datetime('now'))
      AND (m.content LIKE ? OR m.file_name LIKE ?)
      AND (
        c.is_dm = 0
        OR c.id IN (SELECT channel_id FROM channel_members WHERE user_id = ?)
      )
    ORDER BY m.created_at DESC
    LIMIT 40
  `).all(pattern, pattern, user.id) as any[];

  return NextResponse.json(rows.map(r => ({
    id: r.id,
    content: r.content,
    fileName: r.file_name,
    fileUrl: r.file_url,
    fileType: r.file_type,
    createdAt: r.created_at,
    channelId: r.channel_id,
    channelName: r.channel_name,
    isDm: Boolean(r.is_dm),
    username: r.username,
  })));
}
