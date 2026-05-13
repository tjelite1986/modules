import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUploadsRoot, getSubDir } from '@/lib/uploadPaths';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';
import fs from 'fs';
import { convertHeicIfNeeded } from '@/lib/heicConvert';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif']);
const VIDEO_EXTS = new Set(['mp4', 'mov']);
const FILE_EXTS = new Set(['pdf', 'doc', 'docx', 'txt', 'zip', 'apk']);
const MAX_SIZE = 1000 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Max 1GB' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = IMAGE_EXTS.has(ext);
  const isVideo = VIDEO_EXTS.has(ext);
  const isFile = FILE_EXTS.has(ext);
  if (!isImage && !isVideo && !isFile) {
    return NextResponse.json({ error: 'File type not supported' }, { status: 400 });
  }

  const subDir = getSubDir(ext);
  const dir = path.join(getUploadsRoot(), subDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
  const base = safeName.includes('.') ? safeName.slice(0, safeName.lastIndexOf('.')) : safeName;
  const uid = Math.random().toString(36).slice(2, 7);
  const filename = `${base}_${uid}.${ext}`;
  const filepath = path.join(dir, filename);

  const webStream = file.stream();
  const nodeStream = Readable.fromWeb(webStream as any);
  const writeStream = fs.createWriteStream(filepath);
  await pipeline(nodeStream, writeStream);

  let outFilename = filename;
  let outName = file.name;
  if (ext === 'heic' || ext === 'heif') {
    try {
      const conv = await convertHeicIfNeeded(filepath);
      outFilename = conv.filename;
      outName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    } catch (e) {
      console.error('HEIC conversion failed:', e);
    }
  }

  return NextResponse.json({
    url: `/api/uploads/${outFilename}`,
    type: isImage ? 'image' : isVideo ? 'video' : 'file',
    name: outName,
  });
}
