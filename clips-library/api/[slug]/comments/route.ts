import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { findClip, decodeSlugFromUrl } from "@/lib/clips";
import { listClipComments, addClipComment, getCommentCount } from "@/lib/clipComments";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function GET(req: NextRequest, { params }: Props) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slug = decodeSlugFromUrl(decodeURIComponent(params.slug));
  if (!findClip(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(listClipComments(slug));
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slug = decodeSlugFromUrl(decodeURIComponent(params.slug));
  if (!findClip(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { content?: string };
  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "Empty comment" }, { status: 400 });
  if (content.length > 1000) {
    return NextResponse.json({ error: "Too long" }, { status: 400 });
  }
  const comment = addClipComment(slug, user.id, content);
  const count = getCommentCount(slug);
  return NextResponse.json({ comment, count });
}
