import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { listTrips, refreshTrips } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let trips = listTrips(user.id);
  if (trips.length === 0) {
    refreshTrips(user.id);
    trips = listTrips(user.id);
  }
  return NextResponse.json({ trips });
}
