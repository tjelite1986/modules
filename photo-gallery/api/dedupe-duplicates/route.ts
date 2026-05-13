import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { backfillContentHashes, dedupeByContentHash } from "@/lib/gallery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backfill = backfillContentHashes(user.id);
  const dedup = dedupeByContentHash(user.id);
  return NextResponse.json({
    backfill,
    dedup,
  });
}
