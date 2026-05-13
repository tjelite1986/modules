import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  getItem,
  hardDelete,
  restore,
  setDescription,
  setFavorite,
  setRating,
  setTakenAt,
  softDelete,
} from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const item = getItem(user.id, parseInt(params.id, 10));
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt(params.id, 10);
  const body = await req.json().catch(() => ({}));

  if (typeof body.is_favorite === "boolean") {
    const updated = setFavorite(user.id, id, body.is_favorite);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  }

  if (typeof body.rating === "number") {
    const updated = setRating(user.id, id, body.rating);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  }

  if (body.description === null || typeof body.description === "string") {
    const updated = setDescription(user.id, id, body.description);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  }

  if (typeof body.taken_at === "string") {
    const updated = setTakenAt(user.id, id, body.taken_at);
    if (!updated) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    return NextResponse.json(updated);
  }

  if (body.action === "restore") {
    const ok = restore(user.id, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt(params.id, 10);
  const force = req.nextUrl.searchParams.get("force") === "1";

  if (force) {
    const ok = hardDelete(user.id, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const ok = softDelete(user.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
