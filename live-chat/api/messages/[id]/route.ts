import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

function broadcast(event: string, data: unknown) {
  const io = (global as any)._io;
  if (io) io.emit(event, data);
}

// PATCH /api/messages/[id] — edit message
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const messageId = parseInt(params.id);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any;
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (msg.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });

  const now = new Date().toISOString();
  db.prepare("UPDATE messages SET content = ?, edited_at = ? WHERE id = ?").run(content.trim(), now, messageId);
  broadcast('message-edited', { messageId, content: content.trim(), editedAt: now, channelId: msg.channel_id });

  return NextResponse.json({ success: true });
}

// DELETE /api/messages/[id] — delete (own messages or admin)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const messageId = parseInt(params.id);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any;
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userRow = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(user.id) as any;
  const isAdmin = userRow?.is_admin === 1;

  if (msg.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  db.prepare('DELETE FROM reactions WHERE message_id = ?').run(messageId);
  db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
  broadcast('message-deleted', { messageId, channelId: msg.channel_id });

  return NextResponse.json({ success: true });
}
