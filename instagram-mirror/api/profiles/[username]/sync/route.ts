import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { getProfile, isValidSyncMode, syncProfile } from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Props {
  params: { username: string };
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!getProfile(params.username)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode && isValidSyncMode(body.mode) ? body.mode : "all";
  const result = await syncProfile(params.username, { mode });
  return NextResponse.json({ profile: getProfile(params.username), result });
}
