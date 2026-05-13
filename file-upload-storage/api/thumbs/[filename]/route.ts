import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const THUMBS_DIR = path.join(process.env.UPLOADS_DIR || 'uploads', 'thumbs');

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const { filename } = params;
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return new NextResponse(null, { status: 400 });

  const filePath = path.join(THUMBS_DIR, filename + '.jpg');
  if (!fs.existsSync(filePath)) return new NextResponse(null, { status: 404 });

  const data = fs.readFileSync(filePath);
  return new NextResponse(data, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
