import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const db = getDb();
  const channels = db.prepare(`
    SELECT DISTINCT c.* FROM channels c
    LEFT JOIN channel_members cm ON c.id = cm.channel_id
    WHERE c.is_dm = 0 OR cm.user_id = ?
    ORDER BY c.is_dm ASC, c.name ASC
  `).all(user.id) as any[];

  const result = channels.map(c => {
    const lastMsg = db.prepare(`
      SELECT m.content, m.created_at, u.username
      FROM messages m JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ?
      ORDER BY m.created_at DESC LIMIT 1
    `).get(c.id) as any;

    return {
      id: c.id,
      name: c.name,
      description: c.description,
      banner: c.banner ?? null,
      icon: c.icon ?? null,
      isDm: Boolean(c.is_dm),
      createdBy: c.created_by,
      categoryId: c.category_id ?? null,
      lastMessage: lastMsg ? {
        content: lastMsg.content,
        username: lastMsg.username,
        createdAt: lastMsg.created_at,
      } : null,
    };
  });

  return NextResponse.json(result);
}
