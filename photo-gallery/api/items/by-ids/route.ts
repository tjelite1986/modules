import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getItem } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = req.nextUrl.searchParams.get("ids") || "";
  const ids = raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 60);
  if (ids.length === 0) return NextResponse.json({ items: [] });
  const items = ids
    .map((id) => getItem(user.id, id))
    .filter((it): it is NonNullable<typeof it> => !!it && it.is_deleted === 0);
  return NextResponse.json({ items });
}
