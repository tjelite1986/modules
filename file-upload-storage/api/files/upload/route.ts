import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUploadsRoot } from '@/lib/uploadPaths';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';
import fs from 'fs';
import { convertHeicIfNeeded } from '@/lib/heicConvert';

function isValidDir(dir: string): boolean {
  const BUILTIN = ['photo', 'video', 'apk', 'files', 'tiktok'];
  if (BUILTIN.includes(dir)) return true;
  return /^[a-z0-9_-]+$/.test(dir) && dir.length <= 40;
}
const MAX_SIZE = 1000 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dir = req.nextUrl.searchParams.get('dir') ?? 'files';
  if (!isValidDir(dir)) return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Max 1GB' }, { status: 400 });

  const folder = path.join(getUploadsRoot(), dir);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
  const base = safeName.includes('.') ? safeName.slice(0, safeName.lastIndexOf('.')) : safeName;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const uid = Math.random().toString(36).slice(2, 7);
  const filename = `${base}_${uid}.${ext}`;
  const filepath = path.join(folder, filename);

  const nodeStream = Readable.fromWeb(file.stream() as any);
  await pipeline(nodeStream, fs.createWriteStream(filepath));

  let outFilename = filename;
  let outExt = ext;
  let outOriginalName = file.name;
  let outSize = file.size;
  if (ext === 'heic' || ext === 'heif') {
    try {
      const conv = await convertHeicIfNeeded(filepath);
      outFilename = conv.filename;
      outExt = 'jpg';
      outOriginalName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      outSize = fs.statSync(conv.path).size;
    } catch (e) {
      console.error('HEIC conversion failed:', e);
    }
  }

  const TYPE_MAP: Record<string, string> = {
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', heic: 'image', heif: 'image',
    mp4: 'video', mov: 'video',
  };

  return NextResponse.json({
    name: outFilename,
    originalName: outOriginalName,
    size: outSize,
    url: `/api/uploads/${outFilename}`,
    type: TYPE_MAP[outExt] ?? 'file',
    ext: outExt.toUpperCase(),
  });
}
