import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { decodeSlugFromUrl, findClip, setClipTitle } from "@/lib/clips";
import { LIBRARIES } from "@/lib/libraries";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slug = decodeSlugFromUrl(decodeURIComponent(params.slug));
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (title.length > 200) {
    return NextResponse.json({ error: "Title too long" }, { status: 400 });
  }
  const root = LIBRARIES.clips.root;
  if (!findClip(slug, root)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ok = setClipTitle(slug, title, root);
  if (!ok) return NextResponse.json({ error: "Write failed" }, { status: 500 });
  return NextResponse.json({ slug, title });
}
