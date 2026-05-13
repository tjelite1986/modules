import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { isValidUsername, listProfiles, listVideosForProfile } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { username: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username = decodeURIComponent(params.username);
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const profile = listProfiles().find((p) => p.username === username);
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const videos = listVideosForProfile(username);
  return NextResponse.json({ profile, videos });
}
