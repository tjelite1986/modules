import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUploadsRoot } from '@/lib/uploadPaths';
import path from 'path';
import fs from 'fs';

const BUILTIN_DIRS = ['photo', 'video', 'apk', 'files', 'tiktok', 'avatars'];

function isValidDir(dir: string): boolean {
  if (BUILTIN_DIRS.includes(dir)) return true;
  return /^[a-z0-9_-]+$/.test(dir) && dir.length <= 40;
}

const TYPE_MAP: Record<string, 'image' | 'video' | 'file'> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', heic: 'image', heif: 'image',
  mp4: 'video', mov: 'video',
};

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dir = req.nextUrl.searchParams.get('dir') ?? 'files';
  if (!isValidDir(dir)) return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });

  const folder = path.join(getUploadsRoot(), dir);
  if (!fs.existsSync(folder)) return NextResponse.json([]);

  const entries = fs.readdirSync(folder)
    .map(name => {
      const stat = fs.statSync(path.join(folder, name));
      if (!stat.isFile()) return null;
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      return {
        name,
        size: stat.size,
        url: `/api/uploads/${name}`,
        type: TYPE_MAP[ext] ?? 'file',
        ext: ext.toUpperCase(),
        modified: stat.mtimeMs,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b!.modified - a!.modified));

  return NextResponse.json(entries);
}
