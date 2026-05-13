import { NextResponse } from "next/server";
import { listClips } from "@/lib/clips";

export const dynamic = "force-dynamic";

export async function GET() {
  const clips = listClips().map((c) => ({
    slug: c.slug,
    profile: c.profile,
    videoExt: c.videoExt,
    videoMtime: c.videoMtime,
    videoSize: c.videoSize,
    hasPoster: c.posterExt !== null,
    posterMtime: c.posterMtime,
    title: c.meta.title || c.slug,
    description: c.meta.description ?? null,
    uploader: c.meta.uploader ?? null,
    tags: c.meta.tags ?? [],
    url: c.meta.url ?? null,
  }));
  return NextResponse.json(clips);
}
