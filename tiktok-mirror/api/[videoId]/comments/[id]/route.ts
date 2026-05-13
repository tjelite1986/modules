import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteTiktokComment, getTiktokCommentCount } from "@/lib/tiktokComments";

export const dynamic = "force-dynamic";

interface Props {
  params: { videoId: string; id: string };
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const me = db.prepare("SELECT is_admin FROM users WHERE id = ?")
    .get(user.id) as { is_admin: number } | undefined;
  const isAdmin = !!me?.is_admin;

  const ok = deleteTiktokComment(id, user.id, isAdmin);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const videoId = decodeURIComponent(params.videoId);
  return NextResponse.json({ ok: true, count: getTiktokCommentCount(videoId) });
}
