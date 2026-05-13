import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const db = getDb();
  const dbUser = db.prepare('SELECT id, username, display_name, bio, email, avatar, last_seen, is_admin, status, status_text FROM users WHERE id = ?').get(user.id) as any;
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    id: dbUser.id,
    username: dbUser.username,
    displayName: dbUser.display_name,
    bio: dbUser.bio,
    email: dbUser.email,
    avatar: dbUser.avatar,
    lastSeen: dbUser.last_seen,
    isAdmin: Boolean(dbUser.is_admin),
    status: dbUser.status ?? 'online',
    statusText: dbUser.status_text,
  });
}

export async function PATCH(req: NextRequest) {
  const tokenUser = verifyToken(req);
  if (!tokenUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';
  const db = getDb();

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('avatar') as File | null;
    if (!file || !file.size) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return NextResponse.json({ error: 'Invalid file format' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Max 5 MB' }, { status: 400 });
    }

    const { getAvatarsDir } = await import('@/lib/uploadPaths');
    const avatarDir = getAvatarsDir();
    await mkdir(avatarDir, { recursive: true });

    const filename = `${tokenUser.id}_${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(avatarDir, filename), buffer);

    const avatarUrl = `/api/avatars/${filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, tokenUser.id);
    return NextResponse.json({ avatar: avatarUrl });
  }

  const body = await req.json();
  const { displayName, bio, email, currentPassword, newPassword } = body;

  if (newPassword !== undefined) {
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password required' }, { status: 400 });
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(tokenUser.id) as any;
    if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
      return NextResponse.json({ error: 'Current password does not match' }, { status: 400 });
    }
    const hash = bcrypt.hashSync(newPassword, 8);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, tokenUser.id);
    return NextResponse.json({ ok: true });
  }

  if (email !== undefined) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), tokenUser.id);
    if (existing) return NextResponse.json({ error: 'Email address is already in use' }, { status: 409 });
  }

  db.prepare('UPDATE users SET display_name = ?, bio = ?, email = COALESCE(?, email) WHERE id = ?').run(
    displayName?.trim() || null,
    bio?.trim() || null,
    email?.toLowerCase() || null,
    tokenUser.id,
  );

  return NextResponse.json({ ok: true });
}
