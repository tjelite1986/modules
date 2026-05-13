import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getOrCreateAlbumShare, revokeAlbumShare } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const share = getOrCreateAlbumShare(user.id, parseInt(params.id, 10));
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(share);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ok = revokeAlbumShare(user.id, parseInt(params.id, 10));
  return NextResponse.json({ revoked: ok });
}
