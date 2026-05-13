import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { searchItems } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") || "";
  const items = searchItems(user.id, { q });
  return NextResponse.json({ items });
}
