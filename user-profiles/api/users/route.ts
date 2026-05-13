import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const db = getDb();
  const users = db.prepare('SELECT id, username, avatar, last_seen, status, status_text FROM users ORDER BY username ASC').all() as any[];

  return NextResponse.json(users.map(u => ({
    id: u.id,
    username: u.username,
    avatar: u.avatar,
    lastSeen: u.last_seen,
    status: u.status ?? 'online',
    statusText: u.status_text,
  })));
}
