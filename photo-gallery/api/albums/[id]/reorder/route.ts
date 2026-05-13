import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  clearAlbumItemPositions,
  setAlbumItemPositions,
} from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const albumId = parseInt(params.id, 10);
  const body = await req.json().catch(() => ({}));

  if (body?.action === "clear") {
    const result = clearAlbumItemPositions(user.id, albumId);
    return NextResponse.json(result);
  }

  if (!Array.isArray(body?.itemIds)) {
    return NextResponse.json({ error: "itemIds[] required" }, { status: 400 });
  }
  const ids = body.itemIds
    .map((n: unknown) => (typeof n === "number" ? n : parseInt(String(n), 10)))
    .filter((n: number) => Number.isFinite(n));
  const result = setAlbumItemPositions(user.id, albumId, ids);
  return NextResponse.json(result);
}
