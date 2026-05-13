import { NextRequest, NextResponse } from "next/server";
import { getSharedAlbumByToken } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const view = getSharedAlbumByToken(params.token);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view);
}
