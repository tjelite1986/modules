import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { verifyTokenLoose } from "@/lib/auth";
import { getBook } from "@/lib/books";
import { extractCover } from "@/lib/bookCovers";
import { BOOK_COVERS_DIR } from "@/lib/bookStorage";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

export async function GET(req: NextRequest, props: Props) {
  const { slug } = await props.params;
  if (!verifyTokenLoose(req)) return new Response("Unauthorized", { status: 401 });

  const book = getBook(slug);
  if (!book) return new Response("Not found", { status: 404 });

  let coverPath = book.cover_path;
  if (!coverPath || !fs.existsSync(coverPath)) {
    const ok = await extractCover(slug);
    if (!ok) return new Response("No cover", { status: 404 });
    const fresh = getBook(slug);
    coverPath = fresh?.cover_path ?? null;
    if (!coverPath || !fs.existsSync(coverPath)) {
      return new Response("No cover", { status: 404 });
    }
  }

  const abs = path.resolve(coverPath);
  if (!abs.startsWith(BOOK_COVERS_DIR + path.sep)) {
    return new Response("Invalid path", { status: 400 });
  }
  const buf = fs.readFileSync(abs);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mimeFor(abs),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
