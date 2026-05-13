import { NextRequest, NextResponse } from 'next/server';
import { getUploadsRoot } from '@/lib/uploadPaths';
import path from 'path';
import fs from 'fs';

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
};

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const filename = path.basename(params.filename);
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME[ext];
  if (!mime) return NextResponse.json({ error: 'Not allowed' }, { status: 400 });

  const filePath = path.join(getUploadsRoot(), 'icons', filename);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const buf = fs.readFileSync(filePath);
  return new NextResponse(buf.buffer as ArrayBuffer, {
    headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' },
  });
}
