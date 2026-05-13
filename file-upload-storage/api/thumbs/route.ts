import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const THUMBS_DIR = path.join(process.env.UPLOADS_DIR || 'uploads', 'thumbs');

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { filename, dataUrl } = await req.json();
  if (!filename || !dataUrl) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });

  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true });
  fs.writeFileSync(path.join(THUMBS_DIR, filename + '.jpg'), buffer);

  return NextResponse.json({ ok: true });
}
