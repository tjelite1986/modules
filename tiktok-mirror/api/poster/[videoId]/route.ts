import { NextResponse } from "next/server";
import fs from "node:fs";
import { findVideo, videoPosterPath, isValidVideoId } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

interface Props {
  params: { videoId: string };
}

export async function GET(_req: Request, { params }: Props) {
  const videoId = decodeURIComponent(params.videoId);
  if (!isValidVideoId(videoId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const v = findVideo(videoId);
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const file = videoPosterPath(v.username, videoId);
  if (!file) return NextResponse.json({ error: "No poster" }, { status: 404 });

  const buf = fs.readFileSync(file);
  const ext = file.toLowerCase().split(".").pop() || "jpg";
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
