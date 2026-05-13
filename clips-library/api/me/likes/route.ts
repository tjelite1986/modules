import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getUserLikedSlugs } from "@/lib/clipStats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const set = getUserLikedSlugs(user.id);
  return NextResponse.json(Array.from(set));
}
