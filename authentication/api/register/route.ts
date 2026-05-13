import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, username, password, inviteCode } = await req.json();

  if (!email || !username || !password || !inviteCode) {
    return NextResponse.json({ error: 'All fields including invite code are required' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }
  if (username.length < 2 || username.length > 20) {
    return NextResponse.json({ error: 'Username must be 2-20 characters' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return NextResponse.json({ error: 'Only letters, digits, _ and - are allowed' }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
  }

  const db = getDb();

  const code = db.prepare(
    'SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL'
  ).get(inviteCode.toUpperCase().trim()) as any;

  if (!code) {
    return NextResponse.json({ error: 'Invalid or already used invite code' }, { status: 400 });
  }

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existingEmail) {
    return NextResponse.json({ error: 'Email address already registered' }, { status: 409 });
  }

  try {
    const hash = bcrypt.hashSync(password, 8);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).run(username, email.toLowerCase(), hash);

    const userId = result.lastInsertRowid as number;

    db.prepare(
      "UPDATE invite_codes SET used_by = ?, used_at = datetime('now') WHERE id = ?"
    ).run(userId, code.id);

    const token = signToken({ id: userId, username });
    return NextResponse.json({ token, user: { id: userId, username } });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
