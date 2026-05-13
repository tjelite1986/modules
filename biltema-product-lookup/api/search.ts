import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchBiltemTerm } from "@/lib/biltema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q");
  const take = Math.min(parseInt(request.nextUrl.searchParams.get("take") ?? "20"), 50);

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: "At least 2 characters required" }, { status: 400 });
  }

  const results = await fetchBiltemTerm(q.trim(), {
    cache: "revalidate",
    revalidateSeconds: 300,
    take,
  });

  return NextResponse.json({ total: results.length, results });
}
