import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { findClip, decodeSlugFromUrl } from "@/lib/clips";
import { setClipLike, getClipStats } from "@/lib/clipStats";

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

  const body = (await req.json().catch(() => ({}))) as { liked?: boolean };
  const liked = !!body.liked;
  setClipLike(user.id, slug, liked);
  const stats = getClipStats(slug);
  return NextResponse.json({ liked, ...stats });
}
