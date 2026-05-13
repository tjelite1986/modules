import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

function broadcast(event: string, data: any) {
  const io = (global as any)._io;
  if (io) io.emit(event, data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const db = getDb();
  const id = Number(params.id);
  db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name.trim(), id);
  broadcast('category-updated', { id, name: name.trim() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  const db = getDb();
  const id = Number(params.id);
  db.prepare('UPDATE channels SET category_id = NULL WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  broadcast('category-deleted', { categoryId: id });
  return NextResponse.json({ ok: true });
}
