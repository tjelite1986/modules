import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { deleteSavedVideos, listProfileUsernames } from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  let totalRemoved = 0;
  const perProfile: Array<{ username: string; removed: number }> = [];
  for (const u of usernames) {
    const r = deleteSavedVideos(u);
    if (r.removed > 0) perProfile.push({ username: u, removed: r.removed });
    totalRemoved += r.removed;
  }
  return NextResponse.json({
    profiles: usernames.length,
    totalRemoved,
    perProfile,
  });
}
