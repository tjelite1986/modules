import { NextRequest } from "next/server";
import fs from "node:fs";
import {
  findVideo,
  videoFilePathFor,
  profileDir,
  downloadVideo,
  markDownloaded,
  markWatched,
  isValidVideoId,
} from "@/lib/tiktok";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Props {
  params: { videoId: string };
}

export async function GET(req: NextRequest, { params }: Props) {
  const videoId = decodeURIComponent(params.videoId);
  if (!isValidVideoId(videoId)) {
    return new Response("Invalid id", { status: 400 });
  }

  const v = findVideo(videoId);
  if (!v) return new Response("Not found", { status: 404 });

  // Lazy download: if no local file yet, fetch via yt-dlp now.
  let file = videoFilePathFor(v.username, videoId);
  if (!file) {
    try {
      const result = await downloadVideo(v.url, profileDir(v.username), videoId);
      markDownloaded(videoId, result.videoFile);
      file = result.videoFile;
    } catch {
      return new Response("Download failed", { status: 502 });
    }
  }
  markWatched(videoId);

  const stat = fs.statSync(file);
  const total = stat.size;
  const range = req.headers.get("range");
  const ext = file.toLowerCase().endsWith(".web.mp4") ? "mp4" : (file.split(".").pop() ?? "mp4");
  const mime = ext === "webm" ? "video/webm" : "video/mp4";

  const cacheControl = file.toLowerCase().endsWith(".web.mp4")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=300";

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
      const stream = fs.createReadStream(file, { start, end });
      return new Response(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": mime,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": cacheControl,
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
      "Cache-Control": cacheControl,
    },
  });
}
