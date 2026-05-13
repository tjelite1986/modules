import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').toLowerCase();
  const type = searchParams.get('type') ?? 'user';

  const db = getDb();

  if (type === 'channel') {
    const channels = db.prepare(
      `SELECT id, name FROM channels WHERE is_dm = 0 AND LOWER(name) LIKE ? ORDER BY name ASC LIMIT 8`
    ).all(`%${q}%`) as { id: number; name: string }[];
    return NextResponse.json(channels);
  }

  const users = db.prepare(
    `SELECT id, username, avatar FROM users WHERE LOWER(username) LIKE ? ORDER BY username ASC LIMIT 8`
  ).all(`%${q}%`) as { id: number; username: string; avatar: string | null }[];
  return NextResponse.json(users);
}
