import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractJti } from '@/lib/auth';
import { getDb } from '@/lib/db';

function parseDevice(ua: string) {
  if (!ua) return 'Unknown device';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad/i.test(ua)) return 'iOS';
  if (/windows/i.test(ua)) {
    if (/chrome/i.test(ua)) return 'Chrome / Windows';
    if (/firefox/i.test(ua)) return 'Firefox / Windows';
    return 'Windows';
  }
  if (/macintosh/i.test(ua)) {
    if (/chrome/i.test(ua)) return 'Chrome / Mac';
    if (/safari/i.test(ua)) return 'Safari / Mac';
    return 'Mac';
  }
  if (/linux/i.test(ua)) return 'Linux';
  return ua.slice(0, 60);
}

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const currentJti = extractJti(req);

  const sessions = db.prepare(
    'SELECT id, jti, device_info, ip, created_at, last_seen FROM sessions WHERE user_id = ? ORDER BY last_seen DESC'
  ).all(user.id) as any[];

  return NextResponse.json(sessions.map(s => ({
    id: s.id,
    device: parseDevice(s.device_info ?? ''),
    ip: s.ip ?? '',
    createdAt: s.created_at,
    lastSeen: s.last_seen,
    isCurrent: s.jti === currentJti,
  })));
}
