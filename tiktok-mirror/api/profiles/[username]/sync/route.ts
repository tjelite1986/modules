import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { isValidUsername, syncProfile } from "@/lib/tiktok";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: { username: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username = decodeURIComponent(params.username);
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const added = await syncProfile(username);
    return NextResponse.json({ username, added });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 },
    );
  }
}
