import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { verifyTokenLoose } from "@/lib/auth";
import { getBook } from "@/lib/books";
import { BOOKS_ROOT } from "@/lib/bookStorage";

export const dynamic = "force-dynamic";

function mimeFor(format: string): string {
  if (format === "epub") return "application/epub+zip";
  if (format === "pdf") return "application/pdf";
  if (format === "cbz") return "application/vnd.comicbook+zip";
  return "application/octet-stream";
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, props: Props) {
  const { slug } = await props.params;
  if (!verifyTokenLoose(req)) return new Response("Unauthorized", { status: 401 });

  const book = getBook(slug);
  if (!book) return new Response("Not found", { status: 404 });

  // Path-traversal guard: file_path must live under BOOKS_ROOT.
  const abs = path.resolve(book.file_path);
  if (!abs.startsWith(BOOKS_ROOT + path.sep)) {
    return new Response("Invalid path", { status: 400 });
  }
  if (!fs.existsSync(abs)) return new Response("File missing", { status: 404 });

  const stat = fs.statSync(abs);
  const total = stat.size;
  const range = req.headers.get("range");
  const mime = mimeFor(book.format);

  if (range) {
    const m = range.match(/bytes=(\d+)-(\d*)/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (Number.isNaN(start) || start >= total || end >= total || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const stream = fs.createReadStream(abs, { start, end });
      return new Response(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": mime,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  const stream = fs.createReadStream(abs);
  return new Response(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
