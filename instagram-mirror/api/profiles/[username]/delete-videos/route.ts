import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { deleteSavedVideos, getProfile } from "@/lib/instagram";

export const dynamic = "force-dynamic";

interface Props {
  params: { username: string };
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!getProfile(params.username)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const result = deleteSavedVideos(params.username);
  return NextResponse.json(result);
}
