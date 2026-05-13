import { NextRequest } from "next/server";
import { verifyTokenLoose } from "@/lib/auth";
import { getItemForViewing, getFilePath } from "@/lib/gallery";
import fs from "node:fs";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  "3gp": "video/3gpp",
};

export async function GET(req: NextRequest, { params }: { params: { key: string[] } }) {
  const user = verifyTokenLoose(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const storageKey = params.key.map((p) => decodeURIComponent(p)).join("/");
  const item = getItemForViewing(user.id, storageKey);
  if (!item) return new Response("Not found", { status: 404 });

  const file = getFilePath(item, "original");
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });

  const stat = fs.statSync(file);
  const total = stat.size;
  const ext = (file.split(".").pop() || "").toLowerCase();
  const mime = MIME_BY_EXT[ext] || item.mime_type || "application/octet-stream";
  const isVideo = item.kind === "video";

  const range = req.headers.get("range");
  if (range && isVideo) {
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
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      });
    }
  }

  if (isVideo) {
    const stream = fs.createReadStream(file);
    return new Response(stream as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(total),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  }

  const buf = fs.readFileSync(file);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(total),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
