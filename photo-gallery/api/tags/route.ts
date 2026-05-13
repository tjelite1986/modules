import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { addTagToItems, listAllTags } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ tags: listAllTags(user.id) });
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.tag === "string" ? body.tag : "";
  const ids = Array.isArray(body.itemIds)
    ? body.itemIds.filter((n: unknown): n is number => typeof n === "number")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }
  const result = addTagToItems(user.id, ids, raw);
  if (!result) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  return NextResponse.json(result);
}
