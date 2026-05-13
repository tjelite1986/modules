import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

function broadcast(event: string, data: any) {
  const io = (global as any)._io;
  if (io) io.emit(event, data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  const { name, description, categoryId } = await req.json();
  const db = getDb();
  const id = Number(params.id);
  if (name !== undefined) {
    const clean = name.trim();
    if (!clean) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    db.prepare('UPDATE channels SET name = ? WHERE id = ?').run(clean, id);
  }
  if (description !== undefined) db.prepare('UPDATE channels SET description = ? WHERE id = ?').run(description || null, id);
  if (categoryId !== undefined) db.prepare('UPDATE channels SET category_id = ? WHERE id = ?').run(categoryId || null, id);
  const ch = db.prepare('SELECT id, name, description, banner, icon, is_dm, created_by, category_id FROM channels WHERE id = ?').get(id) as any;
  const result = { id: ch.id, name: ch.name, description: ch.description, banner: ch.banner ?? null, icon: ch.icon ?? null, isDm: Boolean(ch.is_dm), createdBy: ch.created_by, categoryId: ch.category_id };
  broadcast('channel-updated', result);
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  const db = getDb();
  const id = Number(params.id);
  db.prepare('DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id = ?)').run(id);
  db.prepare('DELETE FROM messages WHERE channel_id = ?').run(id);
  db.prepare('DELETE FROM channel_members WHERE channel_id = ?').run(id);
  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
  broadcast('channel-deleted', { channelId: id });
  return NextResponse.json({ ok: true });
}
