import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { listProfileUsernames, syncProfile } from "@/lib/tiktok";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

// Auth: either a logged-in admin (manual run from UI) or a request that
// presents the shared SYNC_TOKEN header (cron.daily on the host).
function isAuthorized(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-sync-token");
  const expected = process.env.SYNC_TOKEN;
  if (expected && headerToken && headerToken === expected) return true;
  return verifyAdmin(req) !== null;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usernames = listProfileUsernames();
  const results: Array<{ username: string; added?: number; error?: string }> = [];
  for (const username of usernames) {
    try {
      const added = await syncProfile(username);
      results.push({ username, added });
    } catch (e) {
      results.push({
        username,
        error: e instanceof Error ? e.message : "sync failed",
      });
    }
  }
  return NextResponse.json({
    profiles: usernames.length,
    results,
  });
}
