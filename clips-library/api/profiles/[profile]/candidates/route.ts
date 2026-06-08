import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import {
  existingBasenames,
  fetchProfileEntries,
  getClipProfile,
  listSkippedVideoIds,
} from "@/lib/clipsSync";
import { isValidProfile } from "@/lib/clips";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ profile: string }> },
) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const { profile: name } = await ctx.params;
  if (!isValidProfile(name)) {
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }
  const profile = getClipProfile(name);
  if (!profile) return NextResponse.json({ error: "Unknown profile" }, { status: 404 });
  if (!profile.sourceUrl) {
    return NextResponse.json({ error: "Profile has no source_url" }, { status: 400 });
  }
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? "");
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;

  try {
    const data = await fetchProfileEntries(profile.sourceUrl, limit);
    const existing = existingBasenames(name);
    const skipped = listSkippedVideoIds(name);
    const entries = data.entries.map((e) => {
      const id = String(e.id);
      const videoUrl =
        e.webpage_url ||
        e.url ||
        `${profile.sourceUrl!.replace(/\/$/, "")}/video/${id}`;
      return {
        video_id: id,
        url: videoUrl,
        title: e.title ?? null,
        description: e.description ?? null,
        duration: e.duration ?? null,
        upload_date: e.upload_date ?? null,
        thumbnail: e.thumbnail ?? null,
        has_local: existing.has(id),
        skipped: skipped.has(id),
      };
    });
    return NextResponse.json({
      profile: name,
      uploader: data.uploader,
      count: entries.length,
      entries,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "fetch failed" },
      { status: 502 },
    );
  }
}
