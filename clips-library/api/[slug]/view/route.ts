import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { findClip, decodeSlugFromUrl } from "@/lib/clips";
import { recordClipView, getClipStats } from "@/lib/clipStats";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slug = decodeSlugFromUrl(decodeURIComponent(params.slug));
  if (!findClip(slug)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  recordClipView(user.id, slug);
  const stats = getClipStats(slug);
  return NextResponse.json(stats);
}
