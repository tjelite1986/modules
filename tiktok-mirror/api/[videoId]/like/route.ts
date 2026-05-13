import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { findVideo, isValidVideoId } from "@/lib/tiktok";
import { setTiktokLike, getTiktokStats } from "@/lib/tiktokStats";

export const dynamic = "force-dynamic";

interface Props {
  params: { videoId: string };
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const videoId = decodeURIComponent(params.videoId);
  if (!isValidVideoId(videoId) || !findVideo(videoId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { liked?: boolean };
  const liked = !!body.liked;
  setTiktokLike(user.id, videoId, liked);
  const stats = getTiktokStats(videoId);
  return NextResponse.json({ liked, ...stats });
}
