import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getChannelAssetsDir } from '@/lib/uploadPaths';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';
import fs from 'fs';
import { convertHeicIfNeeded } from '@/lib/heicConvert';

function broadcast(event: string, data: any) {
  const io = (global as any)._io;
  if (io) io.emit(event, data);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Not admin' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const allowed = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif']);
  if (!allowed.has(ext)) return NextResponse.json({ error: 'Image file required' }, { status: 400 });

  const dir = getChannelAssetsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const id = Number(params.id);
  const filename = `icon_${id}_${Date.now()}.${ext}`;
  const filepath = path.join(dir, filename);

  const nodeStream = Readable.fromWeb(file.stream() as any);
  await pipeline(nodeStream, fs.createWriteStream(filepath));

  let finalFilename = filename;
  if (ext === 'heic' || ext === 'heif') {
    try {
      const conv = await convertHeicIfNeeded(filepath);
      finalFilename = conv.filename;
    } catch (e) {
      console.error('HEIC conversion failed:', e);
    }
  }

  const db = getDb();
  const url = `/api/uploads/${finalFilename}`;
  db.prepare('UPDATE channels SET icon = ? WHERE id = ?').run(url, id);

  const ch = db.prepare('SELECT id, name, description, banner, icon, is_dm, created_by, category_id FROM channels WHERE id = ?').get(id) as any;
  const result = { id: ch.id, name: ch.name, description: ch.description, banner: ch.banner, icon: ch.icon, isDm: Boolean(ch.is_dm), createdBy: ch.created_by, categoryId: ch.category_id };
  broadcast('channel-updated', result);
  return NextResponse.json({ url });
}
