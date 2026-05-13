import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { deleteAlbum, getAlbum, updateAlbum } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const album = getAlbum(user.id, parseInt(params.id, 10));
  if (!album) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(album);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt(params.id, 10);
  const body = await req.json().catch(() => ({}));
  const updated = updateAlbum(user.id, id, {
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    description: body.description === null || typeof body.description === "string"
      ? body.description
      : undefined,
    cover_item_id:
      body.cover_item_id === null || typeof body.cover_item_id === "number"
        ? body.cover_item_id
        : undefined,
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ok = deleteAlbum(user.id, parseInt(params.id, 10));
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
