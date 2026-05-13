import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { findVideo, isValidVideoId } from "@/lib/tiktok";
import {
  listTiktokComments,
  addTiktokComment,
  getTiktokCommentCount,
} from "@/lib/tiktokComments";

export const dynamic = "force-dynamic";

interface Props {
  params: { videoId: string };
}

export async function GET(req: NextRequest, { params }: Props) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const videoId = decodeURIComponent(params.videoId);
  if (!isValidVideoId(videoId) || !findVideo(videoId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(listTiktokComments(videoId));
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const videoId = decodeURIComponent(params.videoId);
  if (!isValidVideoId(videoId) || !findVideo(videoId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { content?: string };
  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "Empty comment" }, { status: 400 });
  if (content.length > 1000) {
    return NextResponse.json({ error: "Too long" }, { status: 400 });
  }
  const comment = addTiktokComment(videoId, user.id, content);
  const count = getTiktokCommentCount(videoId);
  return NextResponse.json({ comment, count });
}
