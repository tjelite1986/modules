import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isValidType, isValidSlug, assetsDir, findLogo, findBanner } from "@/lib/store";
import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

function contentTypeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".md") return "text/markdown; charset=utf-8";
  return "application/octet-stream";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { type: string; slug: string; path: string[] } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { type, slug, path: parts } = params;
  if (!isValidType(type)) return new NextResponse("Bad type", { status: 400 });
  if (!isValidSlug(slug)) return new NextResponse("Bad slug", { status: 400 });
  for (const p of parts) {
    if (!SAFE_NAME.test(decodeURIComponent(p))) {
      return new NextResponse("Bad path", { status: 400 });
    }
  }

  const decoded = parts.map((p) => decodeURIComponent(p));
  let filePath: string;
  if (decoded.length === 1 && decoded[0] === "logo") {
    const logo = findLogo(type, slug);
    if (!logo) return new NextResponse("Not found", { status: 404 });
    filePath = logo;
  } else if (decoded.length === 1 && decoded[0] === "banner") {
    const banner = findBanner(type, slug);
    if (!banner) return new NextResponse("Not found", { status: 404 });
    filePath = banner;
  } else {
    const base = assetsDir(type, slug);
    filePath = path.resolve(path.join(base, ...decoded));
    if (!filePath.startsWith(path.resolve(base) + path.sep)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": contentTypeFor(filePath),
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=300",
    },
  });
}
