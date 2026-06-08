import { NextRequest, NextResponse } from "next/server";
import { verifyToken, verifyAdmin } from "@/lib/auth";
import { getBook, deleteBook } from "@/lib/books";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, props: Props) {
  const { slug } = await props.params;
  if (!verifyToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const book = getBook(slug);
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ book });
}

export async function DELETE(req: NextRequest, props: Props) {
  const { slug } = await props.params;
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const ok = deleteBook(slug);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
