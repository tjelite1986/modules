import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { countPurgeableTrash, purgeOldTrash } from "@/lib/gallery";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;

function days(req: NextRequest): number {
  const raw = req.nextUrl.searchParams.get("days");
  const n = raw ? parseInt(raw, 10) : DEFAULT_DAYS;
  return Math.min(Math.max(Number.isFinite(n) ? n : DEFAULT_DAYS, 1), 365);
}

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const d = days(req);
  return NextResponse.json({
    days: d,
    purgeable: countPurgeableTrash(user.id, d),
  });
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const d = days(req);
  const purged = purgeOldTrash(user.id, d);
  return NextResponse.json({ purged, days: d });
}
