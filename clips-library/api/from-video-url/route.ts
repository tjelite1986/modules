import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import {
  downloadSingleVideo,
  fetchVideoMeta,
  getClipProfile,
  pickUploaderHandle,
  upsertClipProfile,
} from "@/lib/clipsSync";

export const dynamic = "force-dynamic";

// One-off: take any yt-dlp-supported video URL, derive the uploader as a
// profile (creating it if missing with auto_poll=0 + videos_limit=null so
// the nightly sync never touches it), and download just that single video.
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { url?: string };
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  let entry;
  try {
    entry = await fetchVideoMeta(url);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Could not resolve video" },
      { status: 400 },
    );
  }

  const profileName = pickProfileName(entry);
  if (!profileName) {
    return NextResponse.json(
      { error: "Could not determine uploader from this URL" },
      { status: 400 },
    );
  }

  const videoId = String((entry as any).id || "");
  if (!videoId) {
    return NextResponse.json({ error: "yt-dlp returned no video id" }, { status: 400 });
  }

  const created = !getClipProfile(profileName);
  if (created) {
    // uploader_url is the handle form (tiktok.com/@handle); channel_url is
    // sometimes the secUid form (tiktok.com/@MS4wLjAB...) which won't poll
    // cleanly — prefer the handle URL when both are present.
    const channelUrl = (entry as any).uploader_url || (entry as any).channel_url || null;
    try {
      upsertClipProfile({
        name: profileName,
        displayName: entry.uploader ?? (entry as any).channel ?? null,
        sourceUrl: channelUrl,
        sourceKind: null,
        autoPoll: false,
        videosLimit: null,
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Failed to create profile" },
        { status: 400 },
      );
    }
  }

  const videoUrl = entry.webpage_url || entry.url || url;
  try {
    await downloadSingleVideo(profileName, videoUrl, videoId, entry);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Download failed", profile: profileName, created },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: profileName, videoId, created });
}

function pickProfileName(entry: {
  uploader_id?: string;
  uploader?: string;
  channel?: string;
  uploader_url?: string;
  channel_url?: string;
}): string | null {
  return pickUploaderHandle(entry);
}
