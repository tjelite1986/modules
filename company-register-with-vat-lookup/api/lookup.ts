import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { like, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  const result = await db
    .select()
    .from(companies)
    .where(
      or(
        like(companies.companyName, `%${q}%`),
        like(companies.companyNumber, `%${q}%`),
        like(companies.organisationNumber, `%${q}%`),
      ),
    )
    .limit(10);

  return NextResponse.json(result);
}
