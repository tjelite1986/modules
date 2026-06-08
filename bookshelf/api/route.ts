import { NextRequest, NextResponse } from "next/server";
import { verifyToken, verifyAdmin } from "@/lib/auth";
import { listBooks, ingestUpload } from "@/lib/books";
import { extractCover } from "@/lib/bookCovers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ books: listBooks(user.id) });
}

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "multipart/form-data required" }, { status: 400 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_UPLOAD_BYTES} bytes)` }, { status: 413 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const title = (form.get("title") as string | null) ?? undefined;
  const author = (form.get("author") as string | null) ?? undefined;
  try {
    const book = ingestUpload({
      filename: file.name,
      buffer: buf,
      addedBy: admin.id,
      titleOverride: title || undefined,
      authorOverride: author || undefined,
    });
    extractCover(book.slug).catch((err) =>
      console.error("[books] cover extract failed", book.slug, err),
    );
    return NextResponse.json({ book });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
