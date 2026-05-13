import { NextRequest } from "next/server";
import { findClip, videoFilePath, videoMime, decodeSlugFromUrl } from "@/lib/clips";
import fs from "node:fs";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function GET(req: NextRequest, { params }: Props) {
  const slug = decodeSlugFromUrl(decodeURIComponent(params.slug));
  const clip = findClip(slug);
  if (!clip) return new Response("Not found", { status: 404 });

  const file = videoFilePath(slug, clip.videoExt);
  if (!file) return new Response("Not found", { status: 404 });

  const stat = fs.statSync(file);
  const total = stat.size;
  const servedExt = file.toLowerCase().endsWith(".web.mp4")
    ? "mp4"
    : file.split(".").pop() ?? clip.videoExt;
  const mime = videoMime(servedExt);
  const range = req.headers.get("range");

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      if (Number.isNaN(start) || start >= total || end >= total || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(file, { start, end });
      return new Response(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": mime,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const stream = fs.createReadStream(file);
  return new Response(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
