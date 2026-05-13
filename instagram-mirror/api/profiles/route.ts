import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { addProfile, listProfiles, parseInstagramUrl } from "@/lib/instagram";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ profiles: listProfiles() });
}

export async function POST(req: NextRequest) {
  const user = verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { input?: string };
  const input = (body.input ?? "").trim();
  if (!input) return NextResponse.json({ error: "URL or username required" }, { status: 400 });
  const username = parseInstagramUrl(input);
  if (!username) {
    return NextResponse.json(
      { error: "Couldn't parse an Instagram username from that input" },
      { status: 400 },
    );
  }
  const profile = addProfile(username);
  if (!profile) return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  return NextResponse.json({ profile });
}
