import { NextRequest } from "next/server";
import fs from "node:fs";
import { getDb } from "@/lib/db";
import { getFilePath, type GalleryItem } from "@/lib/gallery";

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

type Variant = "file" | "thumb" | "preview";

function loadSharedItem(token: string, storageKey: string): GalleryItem | null {
  const db = getDb();
  return (
    (db
      .prepare(
        `SELECT gi.* FROM gallery_album_shares s
           JOIN gallery_album_items ai ON ai.album_id = s.album_id
           JOIN gallery_items gi       ON gi.id = ai.item_id
          WHERE s.share_token = ?
            AND gi.storage_key = ?
            AND gi.is_deleted = 0
            AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)`,
      )
      .get(token, storageKey) as GalleryItem | undefined) || null
  );
}

async function serve(req: NextRequest, token: string, key: string[], variant: Variant) {
  const storageKey = key.map((p) => decodeURIComponent(p)).join("/");
  const item = loadSharedItem(token, storageKey);
  if (!item) return new Response("Not found", { status: 404 });

  const file = getFilePath(item, variant === "file" ? "original" : variant);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });

  if (variant !== "file") {
    const buf = fs.readFileSync(file);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

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
          "Cache-Control": "public, max-age=31536000, immutable",
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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const buf = fs.readFileSync(file);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(total),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string; key: string[] } },
) {
  const variant = (req.nextUrl.searchParams.get("v") as Variant) || "file";
  if (variant !== "file" && variant !== "thumb" && variant !== "preview") {
    return new Response("Bad request", { status: 400 });
  }
  return serve(req, params.token, params.key, variant);
}
