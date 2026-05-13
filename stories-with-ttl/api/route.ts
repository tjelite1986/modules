import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { createStory, listActiveStoryGroups } from "@/lib/stories";
import { notifyFollowers } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ groups: listActiveStoryGroups(user.id) });
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    mediaUrl?: string;
    mediaType?: string;
    caption?: string;
    sourceKind?: string;
    sourceRef?: string;
    ttlSeconds?: number;
  };

  const mediaUrl = body.mediaUrl?.trim();
  if (!mediaUrl) {
    return NextResponse.json({ error: "mediaUrl required" }, { status: 400 });
  }

  const story = createStory(user.id, {
    mediaUrl,
    mediaType: body.mediaType,
    caption: body.caption,
    sourceKind: body.sourceKind,
    sourceRef: body.sourceRef,
    ttlSeconds: body.ttlSeconds,
  });

  const io = (globalThis as { _io?: { emit: (e: string, p: unknown) => void } })._io;
  if (io && story) io.emit("new-story", { userId: user.id, storyId: story.id });

  if (story) {
    notifyFollowers(user.id, "story.new", {
      storyId: story.id,
      authorUsername: story.username,
      authorDisplayName: story.display_name,
      caption: story.caption ?? "",
    });
  }

  return NextResponse.json(story);
}
