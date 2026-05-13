import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUploadsRoot } from '@/lib/uploadPaths';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const root = getUploadsRoot();
  const cacheDir = path.join(root, 'apk-icons');
  fs.mkdirSync(cacheDir, { recursive: true });

  const form = await req.formData();
  const filename = form.get('filename') as string;
  if (!filename) return NextResponse.json({ error: 'Missing filename' }, { status: 400 });

  const destPath = path.join(cacheDir, filename + '.png');

  const libraryFile = form.get('libraryFile') as string | null;
  if (libraryFile) {
    const srcPath = path.join(root, 'icons', path.basename(libraryFile));
    if (!fs.existsSync(srcPath)) return NextResponse.json({ error: 'Library file missing' }, { status: 404 });
    fs.copyFileSync(srcPath, destPath);
    fs.chmodSync(destPath, 0o666);
    return NextResponse.json({ ok: true });
  }

  const file = form.get('icon') as File | null;
  if (!file) return NextResponse.json({ error: 'Missing icon' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  fs.chmodSync(destPath, 0o666);

  return NextResponse.json({ ok: true });
}
