import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { findVideo, isValidVideoId, setTiktokTitle } from "@/lib/tiktok";

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

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (title.length > 200) {
    return NextResponse.json({ error: "Title too long" }, { status: 400 });
  }
  const ok = setTiktokTitle(videoId, title);
  if (!ok) return NextResponse.json({ error: "Write failed" }, { status: 500 });
  return NextResponse.json({ videoId, title });
}
