import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import {
  downloadSingleVideo,
  existingBasenames,
  getClipProfile,
} from "@/lib/clipsSync";
import { isValidProfile } from "@/lib/clips";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VIDEO_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

export async function POST(
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
  const body = (await req.json().catch(() => ({}))) as {
    video_id?: string;
    url?: string;
  };
  const videoId = String(body.video_id ?? "").trim();
  if (!VIDEO_ID_RE.test(videoId)) {
    return NextResponse.json({ error: "Invalid video_id" }, { status: 400 });
  }
  if (existingBasenames(name).has(videoId)) {
    return NextResponse.json({ video_id: videoId, already_present: true });
  }
  const videoUrl =
    body.url && /^https?:\/\//.test(body.url)
      ? body.url
      : `${profile.sourceUrl.replace(/\/$/, "")}/video/${videoId}`;

  try {
    const result = await downloadSingleVideo(name, videoUrl, videoId);
    return NextResponse.json({ video_id: result.videoId, downloaded: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "download failed" },
      { status: 502 },
    );
  }
}
