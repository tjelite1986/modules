import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { deleteProfile, fetchProfileInfo, getProfile } from "@/lib/instagram";

export const dynamic = "force-dynamic";

interface Props {
  params: { username: string };
}

export async function GET(req: NextRequest, { params }: Props) {
  const user = verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = getProfile(params.username);
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ profile });
}

// PATCH triggers a fresh metadata fetch (no media downloads).
export async function PATCH(req: NextRequest, { params }: Props) {
  const user = verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!getProfile(params.username)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const meta = await fetchProfileInfo(params.username);
  return NextResponse.json({ profile: getProfile(params.username), fetched: meta });
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const user = verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ok = deleteProfile(params.username);
  return NextResponse.json({ deleted: ok });
}
