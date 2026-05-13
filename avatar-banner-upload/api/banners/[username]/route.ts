import { NextRequest, NextResponse } from "next/server";
import { readBannerFile } from "@/lib/profileStore";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_req: NextRequest, { params }: { params: { username: string } }) {
  const username = decodeURIComponent(params.username);
  if (!/^[A-Za-z0-9._-]+$/.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }
  const banner = readBannerFile(username);
  if (!banner) return NextResponse.json({ error: "No banner" }, { status: 404 });

  return new NextResponse(new Uint8Array(banner.buffer), {
    status: 200,
    headers: {
      "Content-Type": MIME[banner.ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=60",
    },
  });
}
