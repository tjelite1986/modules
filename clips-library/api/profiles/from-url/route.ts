import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import {
  fetchProfileEntries,
  getClipProfile,
  pickUploaderHandle,
  syncClipProfile,
  upsertClipProfile,
} from "@/lib/clipsSync";

export const dynamic = "force-dynamic";

// Take a profile/channel URL, ask yt-dlp who the uploader is, and create the
// clip_profile entry under that name. videos_limit defaults to the usual 30
// when not supplied. Mirrors /from-video-url but for a whole channel.
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as {
    url?: string;
    videos_limit?: number | null;
    auto_poll?: boolean;
  };
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  if (body.videos_limit !== undefined && body.videos_limit !== null) {
    const n = body.videos_limit;
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      return NextResponse.json({ error: "videos_limit must be 1–1000" }, { status: 400 });
    }
  }

  let resolved;
  try {
    resolved = await fetchProfileEntries(url, 1);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Could not resolve profile" },
      { status: 400 },
    );
  }

  // The submitted URL itself is the canonical uploader_url (e.g.
  // tiktok.com/@handle), so feed it in as a fallback for the handle parser.
  const profileName = pickUploaderHandle({
    uploader: resolved.uploader,
    uploader_id: resolved.uploader_id,
    uploader_url: url,
  });
  if (!profileName) {
    return NextResponse.json(
      { error: "Could not determine uploader from this URL" },
      { status: 400 },
    );
  }

  const created = !getClipProfile(profileName);

  try {
    upsertClipProfile({
      name: profileName,
      displayName: resolved.uploader,
      sourceUrl: url,
      sourceKind: null,
      autoPoll: body.auto_poll ?? true,
      videosLimit: body.videos_limit ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create profile" },
      { status: 400 },
    );
  }

  // Kick off the first sync in the background so the user lands on the
  // profile page already filling up. Fire-and-forget — the response goes out
  // immediately; yt-dlp continues in the same Node process.
  syncClipProfile(profileName).catch((err) => {
    console.error("[from-url] background sync failed", profileName, err);
  });

  return NextResponse.json({ profile: profileName, created });
}
