import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, verifyAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

function broadcast(event: string, data: any) {
  const io = (global as any)._io;
  if (io) io.emit(event, data);
}

export async function GET(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const db = getDb();
  const cats = db.prepare('SELECT id, name, position FROM categories ORDER BY position ASC, id ASC').all();
  return NextResponse.json(cats);
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const db = getDb();
  const maxPos = (db.prepare('SELECT MAX(position) as p FROM categories').get() as any)?.p ?? -1;
  const result = db.prepare('INSERT INTO categories (name, position) VALUES (?, ?)').run(name.trim(), maxPos + 1);
  const cat = { id: Number(result.lastInsertRowid), name: name.trim(), position: maxPos + 1 };
  broadcast('category-created', cat);
  return NextResponse.json(cat);
}
