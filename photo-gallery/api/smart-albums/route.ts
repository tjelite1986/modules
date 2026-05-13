import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { createSmartAlbum, listSmartAlbums } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ smartAlbums: listSmartAlbums(user.id) });
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body?.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  try {
    const album = createSmartAlbum(user.id, body.name, body.filters);
    return NextResponse.json(album);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
