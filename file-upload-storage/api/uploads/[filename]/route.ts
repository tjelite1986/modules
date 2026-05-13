import { NextRequest, NextResponse } from 'next/server';
import { getUploadPath, getUploadsRoot } from '@/lib/uploadPaths';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain', zip: 'application/zip',
  mp4: 'video/mp4', mov: 'video/quicktime',
  apk: 'application/vnd.android.package-archive',
};

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
  const filename = path.basename(params.filename);
  if (!filename || filename.includes('..')) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }

  let filepath = getUploadPath(filename);

  if (!fs.existsSync(filepath)) {
    const root = getUploadsRoot();
    let found: string | undefined;
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const candidate = path.join(root, e.name, filename);
        if (fs.existsSync(candidate)) { found = candidate; break; }
      }
    } catch {}
    if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    filepath = found;
  }

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mime = MIME[ext] || 'application/octet-stream';
  const stat = fs.statSync(filepath);
  const fileSize = stat.size;

  const range = req.headers.get('range');
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), fileSize - 1) : fileSize - 1;
      if (start <= end && start < fileSize) {
        const partial = Readable.toWeb(fs.createReadStream(filepath, { start, end })) as ReadableStream;
        return new NextResponse(partial, {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(end - start + 1),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    }
  }

  const stream = Readable.toWeb(fs.createReadStream(filepath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
