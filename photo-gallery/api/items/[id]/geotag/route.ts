import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { backfillGeotag, getItem } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const item = getItem(user.id, id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.latitude != null && item.longitude != null) {
    return NextResponse.json({
      latitude: item.latitude,
      longitude: item.longitude,
      location_name: item.location_name,
    });
  }
  const gps = await backfillGeotag(user.id, id);
  return NextResponse.json({
    latitude: gps?.latitude ?? null,
    longitude: gps?.longitude ?? null,
    location_name: null,
  });
}
