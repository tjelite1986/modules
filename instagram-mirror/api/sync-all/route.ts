import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { isValidSyncMode, listProfileUsernames, syncProfile } from "@/lib/instagram";

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

  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode && isValidSyncMode(body.mode) ? body.mode : "all";

  const usernames = listProfileUsernames();
  const results: Array<{
    username: string;
    ok?: boolean;
    tool?: string | null;
    added?: number;
    error?: string;
  }> = [];
  for (const username of usernames) {
    try {
      const r = await syncProfile(username, { mode });
      results.push({ username, ok: r.ok, tool: r.tool, added: r.added, error: r.error ?? undefined });
    } catch (e) {
      results.push({ username, ok: false, error: e instanceof Error ? e.message : "sync failed" });
    }
  }
  return NextResponse.json({ profiles: usernames.length, mode, results });
}
