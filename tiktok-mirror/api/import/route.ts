import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  parseTiktokUrl,
  fetchProfileEntries,
  fetchVideoMeta,
  downloadThumbnail,
  upsertProfile,
  upsertVideo,
  profileDir,
  PROFILE_VIDEOS_LIMIT,
} from "@/lib/tiktok";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, limit } = (await req.json()) as { url?: string; limit?: number };
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const parsed = parseTiktokUrl(url);
  if (!parsed) {
    return NextResponse.json({ error: "Not a recognized TikTok URL" }, { status: 400 });
  }

  try {
    if (parsed.kind === "profile") {
      const username = parsed.username!;
      const data = await fetchProfileEntries(parsed.normalizedUrl, limit ?? PROFILE_VIDEOS_LIMIT);
      upsertProfile({
        username,
        displayName: data.uploader,
        markSyncedNow: true,
      });
      const dir = profileDir(username);
      let added = 0;
      for (const entry of data.entries) {
        const videoId = String(entry.id);
        const videoUrl = entry.webpage_url || entry.url || `https://www.tiktok.com/@${username}/video/${videoId}`;
        let thumbPath: string | null = null;
        if (entry.thumbnail) {
          thumbPath = await downloadThumbnail(entry.thumbnail, dir, videoId);
        }
        upsertVideo({
          videoId,
          username,
          url: videoUrl,
          title: entry.title ?? null,
          description: entry.description ?? null,
          duration: entry.duration ?? null,
          uploadDate: entry.upload_date ?? null,
          thumbnailPath: thumbPath,
        });
        added++;
      }
      return NextResponse.json({ kind: "profile", username, added });
    }

    // single video
    const meta = await fetchVideoMeta(parsed.normalizedUrl);
    const username = parsed.username!;
    const videoId = parsed.videoId!;
    upsertProfile({
      username,
      displayName: meta.uploader ?? null,
    });
    let thumbPath: string | null = null;
    if (meta.thumbnail) {
      thumbPath = await downloadThumbnail(meta.thumbnail, profileDir(username), videoId);
    }
    upsertVideo({
      videoId,
      username,
      url: parsed.normalizedUrl,
      title: meta.title ?? null,
      description: meta.description ?? null,
      duration: meta.duration ?? null,
      uploadDate: meta.upload_date ?? null,
      thumbnailPath: thumbPath,
    });
    return NextResponse.json({ kind: "video", username, videoId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 },
    );
  }
}
