import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export interface TokenPayload {
  id: number;
  username: string;
  jti?: string;
  scope?: 'media';
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

function verifyTokenString(token: string, scope: 'session' | 'media' = 'session'): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    // Media tokens are read-only capability tokens for <img>/<video> URLs.
    // They must never authenticate regular API calls, and session tokens
    // must never ride in query strings.
    const tokenScope = payload.scope === 'media' ? 'media' : 'session';
    if (tokenScope !== scope) return null;
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

// Accepts JWT from Authorization header OR a scoped media token from a
// `?t=` query string. Used for resources that browsers fetch via plain
// <img>/<video> tags, where custom headers cannot be set. The query path
// only accepts short-lived `scope: media` tokens (see signMediaToken), so
// a token leaked via logs or Referer cannot be replayed against the API.
export function verifyTokenLoose(req: NextRequest): TokenPayload | null {
  const fromHeader = verifyToken(req);
  if (fromHeader) return fromHeader;
  const t = req.nextUrl.searchParams.get('t');
  if (!t) return null;
  return verifyTokenString(t, 'media');
}

export function signToken(payload: Omit<TokenPayload, 'jti'>): string {
  const jti = randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: '30d' });
}

// Short-lived capability token embedded in media URLs (?t=). Inherits the
// parent session's jti so logging out revokes outstanding media tokens too.
export function signMediaToken(user: TokenPayload): string {
  return jwt.sign(
    { id: user.id, username: user.username, jti: user.jti, scope: 'media' },
    JWT_SECRET,
    { expiresIn: '24h' },
  );
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
