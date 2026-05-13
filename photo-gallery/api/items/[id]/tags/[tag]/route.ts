import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getTagsForItem, removeTagFromItem } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; tag: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const itemId = parseInt(params.id, 10);
  const ok = removeTagFromItem(user.id, itemId, decodeURIComponent(params.tag));
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ tags: getTagsForItem(user.id, itemId) });
}
