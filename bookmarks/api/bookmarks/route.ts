import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const rows = db.prepare(`
    SELECT b.message_id, b.created_at,
      m.channel_id, m.user_id, m.content, m.file_url, m.file_type, m.file_name, m.file_size,
      m.created_at AS msg_created_at, u.username, u.avatar
    FROM bookmarks b
    JOIN messages m ON b.message_id = m.id
    JOIN users u ON m.user_id = u.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).all(user.id) as any[];

  return NextResponse.json(rows.map(r => ({
    messageId: r.message_id,
    bookmarkedAt: r.created_at,
    channelId: r.channel_id,
    userId: r.user_id,
    username: r.username,
    avatar: r.avatar,
    content: r.content,
    fileUrl: r.file_url,
    fileType: r.file_type,
    fileName: r.file_name,
    fileSize: r.file_size,
    createdAt: r.msg_created_at,
  })));
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { messageId } = await req.json();
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });

  const db = getDb();
  try {
    db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, message_id) VALUES (?, ?)').run(user.id, messageId);
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
