import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { addTagToItem, getTagsForItem } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tags = getTagsForItem(user.id, parseInt(params.id, 10));
  return NextResponse.json({ tags });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.tag === "string" ? body.tag : "";
  const tag = addTagToItem(user.id, parseInt(params.id, 10), raw);
  if (!tag) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  const tags = getTagsForItem(user.id, parseInt(params.id, 10));
  return NextResponse.json({ tag, tags });
}
