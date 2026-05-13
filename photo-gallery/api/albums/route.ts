import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { createAlbum, listAlbums } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ albums: listAlbums(user.id) });
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const description = typeof body.description === "string" ? body.description : null;
  const album = createAlbum(user.id, name, description);
  return NextResponse.json(album);
}
