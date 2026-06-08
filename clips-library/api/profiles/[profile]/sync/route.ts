import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { syncClipProfile } from "@/lib/clipsSync";
import { isValidProfile } from "@/lib/clips";
import { getSecret } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

function isAuthorized(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-sync-token");
  const expected = getSecret("SYNC_TOKEN");
  if (expected && headerToken && headerToken === expected) return true;
  return verifyAdmin(req) !== null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ profile: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { profile } = await ctx.params;
  if (!isValidProfile(profile)) {
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }
  try {
    const result = await syncClipProfile(profile);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "sync failed" },
      { status: 400 },
    );
  }
}
