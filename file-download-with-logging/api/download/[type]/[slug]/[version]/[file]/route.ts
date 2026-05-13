import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isValidType, isValidSlug, isValidFileName, appDir } from "@/lib/store";
import { recordDownload } from "@/lib/downloads";
import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

const SAFE_VERSION = /^[0-9][0-9A-Za-z._-]*$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: { type: string; slug: string; version: string; file: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { type, slug, version, file } = params;
  const decodedVersion = decodeURIComponent(version);
  const decodedFile = decodeURIComponent(file);

  if (!isValidType(type)) return new NextResponse("Bad type", { status: 400 });
  if (!isValidSlug(slug)) return new NextResponse("Bad slug", { status: 400 });
  if (!SAFE_VERSION.test(decodedVersion)) return new NextResponse("Bad version", { status: 400 });
  if (!isValidFileName(decodedFile)) return new NextResponse("Bad file", { status: 400 });

  const base = appDir(type, slug);
  const filePath = path.resolve(path.join(base, decodedVersion, decodedFile));
  if (!filePath.startsWith(path.resolve(base) + path.sep)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);
  const userId = session.user?.id ? Number(session.user.id) : null;
  recordDownload({
    userId: Number.isFinite(userId) ? (userId as number) : null,
    type,
    appName: slug,
    version: decodedVersion,
    fileName: decodedFile,
  });

  const ext = path.extname(decodedFile).toLowerCase();
  const contentType =
    ext === ".apk" ? "application/vnd.android.package-archive" :
    ext === ".xapk" ? "application/octet-stream" :
    ext === ".apks" ? "application/octet-stream" :
    ext === ".obb" ? "application/octet-stream" :
    ext === ".zip" ? "application/zip" :
    "application/octet-stream";

  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
  const fallbackName = decodedFile.replace(/[^A-Za-z0-9._-]+/g, "_");
  const encodedName = encodeURIComponent(decodedFile);
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "no-store",
    },
  });
}
