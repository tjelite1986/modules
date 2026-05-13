import { NextRequest, NextResponse } from 'next/server';
import { getUploadsRoot } from '@/lib/uploadPaths';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

function getPngDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { w, h };
}

function extractApkIcon(apkPath: string): Buffer | null {
  try {
    const zip = new AdmZip(apkPath);
    const entries = zip.getEntries();

    const mipmapPriority = [
      'res/mipmap-xxxhdpi-v4/ic_launcher.png', 'res/mipmap-xxxhdpi/ic_launcher.png',
      'res/mipmap-xxhdpi-v4/ic_launcher.png',  'res/mipmap-xxhdpi/ic_launcher.png',
      'res/mipmap-xhdpi-v4/ic_launcher.png',   'res/mipmap-xhdpi/ic_launcher.png',
      'res/mipmap-hdpi-v4/ic_launcher.png',    'res/mipmap-hdpi/ic_launcher.png',
    ];
    for (const p of mipmapPriority) {
      const entry = zip.getEntry(p);
      if (entry) return zip.readFile(entry);
    }

    const pngs = entries.filter(e =>
      e.entryName.startsWith('res/') &&
      e.entryName.endsWith('.png') &&
      !e.entryName.endsWith('.9.png')
    );

    type Candidate = { buf: Buffer; w: number };
    const candidates: Candidate[] = [];

    for (const entry of pngs) {
      const buf = zip.readFile(entry);
      if (!buf) continue;
      const dim = getPngDimensions(buf);
      if (!dim) continue;
      const { w, h } = dim;
      if (w === h && w >= 48 && w <= 192) {
        candidates.push({ buf, w });
      }
    }

    if (candidates.length === 0) return null;

    function hasAlpha(buf: Buffer): boolean {
      return buf.length > 25 && (buf[25] === 6 || buf[25] === 4);
    }
    function colorScore(buf: Buffer): number {
      const seen = new Set<number>();
      for (let i = 33; i + 3 < buf.length; i += 40) {
        const key = (buf[i] >> 3) << 10 | (buf[i+1] >> 3) << 5 | (buf[i+2] >> 3);
        seen.add(key);
      }
      return seen.size;
    }

    candidates.sort((a, b) => b.w - a.w);
    const topW = candidates[0].w;
    const top = candidates.filter(c => c.w === topW);
    top.sort((a, b) => {
      const aAlpha = hasAlpha(a.buf) ? 1 : 0;
      const bAlpha = hasAlpha(b.buf) ? 1 : 0;
      if (aAlpha !== bAlpha) return aAlpha - bAlpha;
      return colorScore(b.buf) - colorScore(a.buf);
    });
    return top[0].buf;
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const filename = path.basename(params.filename);
  if (!filename.endsWith('.apk')) {
    return NextResponse.json({ error: 'Not an APK' }, { status: 400 });
  }

  const cacheDir = path.join(getUploadsRoot(), 'apk-icons');
  const cachePath = path.join(cacheDir, filename + '.png');

  if (fs.existsSync(cachePath)) {
    const buf = fs.readFileSync(cachePath);
    return new NextResponse(buf.buffer as ArrayBuffer, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  }

  const root = getUploadsRoot();
  const apkPath = ['apk', 'apk_games'].map(d => path.join(root, d, filename)).find(p => fs.existsSync(p));
  if (!apkPath) {
    return NextResponse.json({ error: 'APK not found' }, { status: 404 });
  }

  const iconBuf = extractApkIcon(apkPath);
  if (!iconBuf) {
    return NextResponse.json({ error: 'No icon found' }, { status: 404 });
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, iconBuf);

  return new NextResponse(iconBuf.buffer as ArrayBuffer, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
