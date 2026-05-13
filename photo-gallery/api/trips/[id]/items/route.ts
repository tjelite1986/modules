import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

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

  const db = getDb();
  const trip = db
    .prepare(`SELECT id FROM gallery_trips WHERE id = ? AND user_id = ?`)
    .get(tripId, user.id) as { id: number } | undefined;
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orderParam = req.nextUrl.searchParams.get("order");
  const order = orderParam === "desc" ? "DESC" : "ASC";

  const items = db
    .prepare(
      `SELECT gi.*
         FROM gallery_trip_items gti
         JOIN gallery_items gi ON gi.id = gti.item_id
        WHERE gti.trip_id = ? AND gi.is_deleted = 0
        ORDER BY gi.taken_at ${order}, gi.id ${order}`,
    )
    .all(tripId);

  return NextResponse.json({ items });
}
