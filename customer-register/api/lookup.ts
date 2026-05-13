import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq, or, like, inArray } from "drizzle-orm";
import { ssnVariants } from "@/lib/customers";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const ssn = searchParams.get("ssn")?.trim();
  const ssnSearch = searchParams.get("ssn_search")?.trim();

  if (!q && !ssn && !ssnSearch) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  // Partial SSN match — returns up to 10 results
  if (ssnSearch) {
    const clean = ssnSearch.replace(/[-\s]/g, "");
    const patterns: string[] = [`%${clean}%`];
    if (!/^(19|20)/.test(clean)) {
      patterns.push(`%19${clean}%`);
    }
    const conditions = patterns.map((p) => like(customers.ssn, p));
    const result = await db
      .select()
      .from(customers)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .limit(10);
    return NextResponse.json(result);
  }

  // Exact SSN match — normalises format variants
  if (ssn) {
    const variants = ssnVariants(ssn);
    const result = await db
      .select()
      .from(customers)
      .where(
        variants.length === 1
          ? eq(customers.ssn, variants[0])
          : inArray(customers.ssn, variants),
      )
      .limit(1);
    if (result.length === 0) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(result[0]);
  }

  // Match on customer number OR phone
  const result = await db
    .select()
    .from(customers)
    .where(or(eq(customers.customerNumber, q!), eq(customers.phone, q!)))
    .limit(1);
  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(result[0]);
}
