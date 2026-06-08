import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export interface TokenPayload {
  id: number;
  username: string;
  jti?: string;
}

export function verifyAdmin(req: NextRequest): TokenPayload | null {
  const user = verifyToken(req);
  if (!user) return null;
  const { getDb } = require('./db');
  const db = getDb();
  const row = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(user.id) as any;
  return row?.is_admin ? user : null;
}

export function verifyToken(req: NextRequest): TokenPayload | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyTokenString(token);
}

function verifyTokenString(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (payload.jti) {
      const { getDb } = require('./db');
      const db = getDb();
      const session = db.prepare('SELECT id FROM sessions WHERE jti = ?').get(payload.jti);
      if (!session) return null;
      db.prepare(`UPDATE sessions SET last_seen = CURRENT_TIMESTAMP
        WHERE jti = ? AND (julianday('now') - julianday(last_seen)) * 1440 > 5`).run(payload.jti);
    }
    return payload;
  } catch {
    return null;
  }
}

// Same as verifyToken but also accepts a `?t=<jwt>` query parameter. Used
// for asset routes that browsers fetch via plain <img>/<video> tags where
// custom Authorization headers cannot be set.
export function verifyTokenLoose(req: NextRequest): TokenPayload | null {
  const fromHeader = verifyToken(req);
  if (fromHeader) return fromHeader;
  const t = req.nextUrl.searchParams.get('t');
  if (!t) return null;
  return verifyTokenString(t);
}

export function signToken(payload: Omit<TokenPayload, 'jti'>): string {
  const jti = randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: '30d' });
}

export function extractJti(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const payload = jwt.decode(token) as TokenPayload | null;
    return payload?.jti ?? null;
  } catch {
    return null;
  }
}
