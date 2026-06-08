import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { syncAllAutoPollProfiles } from "@/lib/clipsSync";
import { getSecret } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

function isAuthorized(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-sync-token");
  const expected = getSecret("SYNC_TOKEN");
  if (expected && headerToken && headerToken === expected) return true;
  return verifyAdmin(req) !== null;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await syncAllAutoPollProfiles();
  return NextResponse.json({
    profiles: results.length,
    results,
  });
}
