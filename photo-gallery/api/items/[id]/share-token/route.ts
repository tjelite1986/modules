import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getOrCreateItemShare } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const itemId = parseInt(params.id, 10);
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const share = getOrCreateItemShare(user.id, itemId);
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    token: share.token,
    url: `/api/gallery/shared-item/${share.token}`,
  });
}
