import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getItem, readItemExif, getFilePath } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const item = getItem(user.id, parseInt(params.id, 10));
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.kind !== "image") return NextResponse.json({});
  const exif = await readItemExif(getFilePath(item, "original"));
  return NextResponse.json(exif);
}
