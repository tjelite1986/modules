import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUploadsRoot } from '@/lib/uploadPaths';
import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const iconsDir = path.join(getUploadsRoot(), 'icons');
  if (!fs.existsSync(iconsDir)) return NextResponse.json([]);

  const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  const files = fs.readdirSync(iconsDir)
    .filter(f => EXTS.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map(f => `/api/apk-icon/library/${encodeURIComponent(f)}`);

  return NextResponse.json(files);
}
