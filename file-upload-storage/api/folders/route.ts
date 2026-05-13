import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getUploadsRoot } from '@/lib/uploadPaths';
import path from 'path';
import fs from 'fs';

const BUILTIN: { id: string; label: string; icon: string; position: number }[] = [
  { id: 'apk',    label: 'Android-paket', icon: 'apk', position: 0 },
  { id: 'photo',  label: 'Foton',         icon: 'img', position: 1 },
  { id: 'video',  label: 'Videor',        icon: 'vid', position: 2 },
  { id: 'tiktok', label: 'TikTok',        icon: 'tt',  position: 3 },
  { id: 'files',  label: 'Dokument',      icon: 'doc', position: 4 },
];

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const custom = db.prepare('SELECT * FROM folder_config ORDER BY position ASC').all() as any[];

  const customMap: Record<string, any> = {};
  for (const row of custom) customMap[row.id] = row;

  const builtinWithConfig = BUILTIN.map(b => ({
    id: b.id,
    label: customMap[b.id]?.label || b.label,
    icon: customMap[b.id]?.icon || b.icon,
    autoshareChannelId: customMap[b.id]?.autoshare_channel_id ?? null,
    isBuiltin: true,
    position: b.position,
  }));

  const customOnly = custom
    .filter(c => !BUILTIN.find(b => b.id === c.id))
    .map(c => ({
      id: c.id,
      label: c.label,
      icon: c.icon,
      autoshareChannelId: c.autoshare_channel_id ?? null,
      isBuiltin: false,
      position: c.position,
    }));

  return NextResponse.json([...builtinWithConfig, ...customOnly].sort((a, b) => a.position - b.position));
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, label, icon } = body;

  if (!id || !/^[a-z0-9_-]+$/.test(id) || id.length > 40) {
    return NextResponse.json({ error: 'Invalid folder ID (a-z, 0-9, _, -)' }, { status: 400 });
  }
  if (!label || label.trim().length === 0) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM folder_config WHERE id = ?').get(id);
  if (existing || BUILTIN.find(b => b.id === id)) {
    return NextResponse.json({ error: 'Folder ID already in use' }, { status: 409 });
  }

  const maxPos = (db.prepare('SELECT MAX(position) as p FROM folder_config').get() as any)?.p ?? 4;
  db.prepare('INSERT INTO folder_config (id, label, icon, position) VALUES (?, ?, ?, ?)')
    .run(id, label.trim(), icon || 'folder', maxPos + 1);

  const folder = path.join(getUploadsRoot(), id);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    fs.chmodSync(folder, 0o777);
  }

  return NextResponse.json({ id, label: label.trim(), icon: icon || 'folder', autoshareChannelId: null, isBuiltin: false });
}
