import { NextRequest, NextResponse } from "next/server";
import { getHolidays } from "@/lib/holidays";

export const dynamic = "force-dynamic";

/**
 * GET /api/holidays?year=2026
 * Returns all Swedish public holidays for the given year (defaults to current).
 *
 * No auth — holidays are public information. Add `getServerSession()` if your
 * app requires auth on every endpoint.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
  if (isNaN(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  return NextResponse.json(getHolidays(year));
}
