import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

function broadcast(event: string, data: unknown) {
  const io = (global as any)._io;
  if (io) io.emit(event, data);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const channelId = parseInt(params.id);
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.message_id, p.pinned_at,
           m.content, m.file_url, m.file_type, m.file_name,
           u.username, pu.username AS pinned_by_username
    FROM pinned_messages p
    JOIN messages m ON p.message_id = m.id
    JOIN users u ON m.user_id = u.id
    JOIN users pu ON p.pinned_by = pu.id
    WHERE p.channel_id = ?
    ORDER BY p.pinned_at DESC
  `).all(channelId) as any[];

  return NextResponse.json(rows.map(r => ({
    messageId: r.message_id,
    content: r.content,
    fileUrl: r.file_url,
    fileType: r.file_type,
    fileName: r.file_name,
    username: r.username,
    pinnedAt: r.pinned_at,
    pinnedBy: r.pinned_by_username,
  })));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const userRow = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(user.id) as any;
  if (!userRow?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const channelId = parseInt(params.id);
  const { messageId } = await req.json();

  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND channel_id = ?').get(messageId, channelId) as any;
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare(`
    INSERT OR IGNORE INTO pinned_messages (channel_id, message_id, pinned_by)
    VALUES (?, ?, ?)
  `).run(channelId, messageId, user.id);

  const pinnerUser = db.prepare('SELECT username FROM users WHERE id = ?').get(user.id) as any;
  const msgUser = db.prepare('SELECT username FROM users WHERE id = ?').get(msg.user_id) as any;

  const pin = {
    messageId,
    content: msg.content,
    fileUrl: msg.file_url,
    fileType: msg.file_type,
    fileName: msg.file_name,
    username: msgUser?.username,
    pinnedBy: pinnerUser?.username,
    pinnedAt: new Date().toISOString(),
  };

  broadcast('message-pinned', { channelId, pin });
  return NextResponse.json(pin);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const userRow = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(user.id) as any;
  if (!userRow?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const channelId = parseInt(params.id);
  const { messageId } = await req.json();

  db.prepare('DELETE FROM pinned_messages WHERE channel_id = ? AND message_id = ?').run(channelId, messageId);
  broadcast('message-unpinned', { channelId, messageId });
  return NextResponse.json({ ok: true });
}
