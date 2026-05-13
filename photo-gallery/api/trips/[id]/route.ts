import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { applyTripNameRule, deleteTrip, listTrips, updateTrip } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tripId = Number(params.id);
  if (!Number.isFinite(tripId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const trip = listTrips(user.id).find((t) => t.id === tripId);
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(trip);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tripId = Number(params.id);
  if (!Number.isFinite(tripId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const applyToAll = (body as { apply_to_all?: unknown }).apply_to_all === true;
  if (applyToAll) {
    const rawTitle = (body as { title?: unknown }).title;
    if (typeof rawTitle !== "string" || rawTitle.trim().length === 0) {
      return NextResponse.json(
        { error: "apply_to_all requires a non-empty title" },
        { status: 400 },
      );
    }
    const result = applyTripNameRule(user.id, tripId, rawTitle);
    if (!result.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      affected: result.affected,
      auto_title: result.auto_title,
    });
  }

  const patch: { title?: string | null; cover_item_id?: number | null; hidden?: boolean } = {};
  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const t = (body as { title?: unknown }).title;
    if (t === null || typeof t === "string") patch.title = t;
  }
  if (Object.prototype.hasOwnProperty.call(body, "cover_item_id")) {
    const c = (body as { cover_item_id?: unknown }).cover_item_id;
    if (c === null) patch.cover_item_id = null;
    else if (typeof c === "number" && Number.isFinite(c)) patch.cover_item_id = c;
  }
  if (Object.prototype.hasOwnProperty.call(body, "hidden")) {
    const h = (body as { hidden?: unknown }).hidden;
    if (typeof h === "boolean") patch.hidden = h;
  }
  const ok = updateTrip(user.id, tripId, patch);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tripId = Number(params.id);
  if (!Number.isFinite(tripId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const ok = deleteTrip(user.id, tripId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
