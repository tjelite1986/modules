import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import {
  listClipProfiles,
  upsertClipProfile,
} from "@/lib/clipsSync";
import { isValidProfile } from "@/lib/clips";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ profiles: listClipProfiles() });
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as {
    name?: string;
    display_name?: string | null;
    source_url?: string | null;
    source_kind?: string | null;
    auto_poll?: boolean;
    videos_limit?: number | null;
  };
  if (!body.name || !isValidProfile(body.name)) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  try {
    const profile = upsertClipProfile({
      name: body.name,
      displayName: body.display_name ?? null,
      sourceUrl: body.source_url ?? null,
      sourceKind: body.source_kind ?? null,
      autoPoll: body.auto_poll,
      videosLimit: body.videos_limit,
    });
    return NextResponse.json({ profile });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "invalid input" }, { status: 400 });
  }
}
