import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getReadingState, setReadingState, getBook } from "@/lib/books";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, props: Props) {
  const { slug } = await props.params;
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!getBook(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ state: getReadingState(slug, user.id) });
}

export async function POST(req: NextRequest, props: Props) {
  const { slug } = await props.params;
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!getBook(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    position?: string;
    percent?: number;
    finished?: boolean;
  };
  setReadingState(slug, user.id, {
    position: body.position ?? null,
    percent: typeof body.percent === "number" ? Math.max(0, Math.min(100, Math.round(body.percent))) : undefined,
    finished: body.finished,
  });
  return NextResponse.json({ ok: true });
}
