import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { addItemsToAlbum, removeItemsFromAlbum } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const albumId = parseInt(params.id, 10);
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.itemIds)
    ? body.itemIds.filter((n: unknown): n is number => typeof n === "number")
    : [];
  const added = addItemsToAlbum(user.id, albumId, ids);
  return NextResponse.json({ added });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const albumId = parseInt(params.id, 10);
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.itemIds)
    ? body.itemIds.filter((n: unknown): n is number => typeof n === "number")
    : [];
  const removed = removeItemsFromAlbum(user.id, albumId, ids);
  return NextResponse.json({ removed });
}
