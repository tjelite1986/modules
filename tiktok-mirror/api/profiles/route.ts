import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { listProfiles } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(listProfiles());
}
