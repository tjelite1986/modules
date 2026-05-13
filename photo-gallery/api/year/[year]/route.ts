import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getYearInReview } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { year: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const year = parseInt(params.year, 10);
  if (!Number.isFinite(year) || year < 1900 || year > 2999) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  const review = getYearInReview(user.id, year);
  return NextResponse.json(review);
}
