import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { setAuthCookie } from '@/lib/authCookie';
import { checkAllowed, recordFailure, recordSuccess } from '@/lib/loginRateLimit';

export async function POST(req: NextRequest) {
  const { identifier, password } = await req.json();

  if (!identifier || !password) {
    return NextResponse.json({ error: 'Email/username and password are required' }, { status: 400 });
  }

  const gate = checkAllowed(identifier);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfterSec ?? 60) } },
    );
  }

  const db = getDb();
  const isEmail = identifier.includes('@');
  const user = isEmail
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(identifier.toLowerCase()) as any
    : db.prepare('SELECT * FROM users WHERE username = ?').get(identifier) as any;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordFailure(identifier);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  recordSuccess(identifier);

  const token = signToken({ id: user.id, username: user.username });

  try {
    const jti = (require('jsonwebtoken').decode(token) as any)?.jti;
    if (jti) {
      const ua = req.headers.get('user-agent') ?? '';
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? '';
      const deviceInfo = ua.length > 200 ? ua.slice(0, 200) : ua;
      db.prepare('INSERT OR IGNORE INTO sessions (user_id, jti, device_info, ip) VALUES (?, ?, ?, ?)').run(user.id, jti, deviceInfo, ip);
    }
  } catch {}

  const res = NextResponse.json({ token, user: { id: user.id, username: user.username } });
  setAuthCookie(res, token, req);
  return res;
}
