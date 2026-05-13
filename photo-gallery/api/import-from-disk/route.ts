import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { verifyToken } from "@/lib/auth";
import { ingestUpload } from "@/lib/gallery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

const IMPORT_ROOT = "/store/import";
const ALLOWED_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|mp4|webm|mov|m4v|mkv)$/i;

function listFiles(): string[] {
  if (!fs.existsSync(IMPORT_ROOT)) return [];
  return fs
    .readdirSync(IMPORT_ROOT, { withFileTypes: true })
    .filter((d) => d.isFile() && ALLOWED_EXT.test(d.name))
    .map((d) => d.name);
}

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    path: IMPORT_ROOT,
    pending: listFiles(),
    exists: fs.existsSync(IMPORT_ROOT),
  });
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!fs.existsSync(IMPORT_ROOT)) {
    return NextResponse.json(
      { error: `Import folder does not exist: ${IMPORT_ROOT}` },
      { status: 404 },
    );
  }
  const files = listFiles();
  if (files.length === 0) {
    return NextResponse.json({ imported: 0, errors: [], processed: [] });
  }

  const processedDir = path.join(IMPORT_ROOT, ".processed");
  if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });

  const imported: any[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const filename of files) {
    const fullPath = path.join(IMPORT_ROOT, filename);
    try {
      const buffer = fs.readFileSync(fullPath);
      const stat = fs.statSync(fullPath);
      const item = await ingestUpload({
        userId: user.id,
        filename,
        mimeType: "application/octet-stream",
        buffer,
        fallbackTakenAt: stat.mtime,
      });
      imported.push({ id: item.id, filename, latitude: item.latitude, longitude: item.longitude });
      try {
        fs.renameSync(fullPath, path.join(processedDir, filename));
      } catch {}
    } catch (err: any) {
      errors.push({ filename, error: err?.message || "unknown" });
    }
  }

  return NextResponse.json({
    imported: imported.length,
    items: imported,
    errors,
  });
}
