import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { deleteTagForUser, renameTag } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { tag: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const oldTag = decodeURIComponent(params.tag);
  const body = await req.json().catch(() => ({}));
  const newTag = typeof body.rename === "string" ? body.rename : "";
  const result = renameTag(user.id, oldTag, newTag);
  if (!result) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  return NextResponse.json(result);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { tag: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tag = decodeURIComponent(params.tag);
  const removed = deleteTagForUser(user.id, tag);
  return NextResponse.json({ removed });
}
