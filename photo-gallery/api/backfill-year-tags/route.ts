import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { backfillYearTags } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(backfillYearTags(user.id));
}
