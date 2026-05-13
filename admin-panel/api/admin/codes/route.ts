import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const db = getDb();
  const codes = db.prepare(`
    SELECT ic.*, u.username as used_by_username
    FROM invite_codes ic
    LEFT JOIN users u ON ic.used_by = u.id
    ORDER BY ic.created_at DESC
  `).all() as any[];

  return NextResponse.json(codes.map(c => ({
    id: c.id,
    code: c.code,
    usedBy: c.used_by_username ?? null,
    usedAt: c.used_at ?? null,
    createdAt: c.created_at,
  })));
}

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const db = getDb();
  let code = generateCode();
  let attempts = 0;
  while (attempts < 5) {
    try {
      db.prepare('INSERT INTO invite_codes (code, created_by) VALUES (?, ?)').run(code, admin.id);
      return NextResponse.json({ code });
    } catch {
      code = generateCode();
      attempts++;
    }
  }
  return NextResponse.json({ error: 'Could not generate code' }, { status: 500 });
}

export async function DELETE(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: 'Code missing' }, { status: 400 });

  const db = getDb();
  db.prepare('DELETE FROM invite_codes WHERE code = ? AND used_by IS NULL').run(code);
  return NextResponse.json({ ok: true });
}
