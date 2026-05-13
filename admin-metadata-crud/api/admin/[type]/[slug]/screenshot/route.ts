import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { isValidType, isValidSlug, assetsDir } from "@/lib/store";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";
const ALLOWED = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: { type: string; slug: string } },
) {
  const guard = await requireAdmin();
  if (guard) return guard;
  if (!isValidType(params.type)) return new NextResponse("Bad type", { status: 400 });
  if (!isValidSlug(params.slug)) return new NextResponse("Bad slug", { status: 400 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new NextResponse("file required", { status: 400 });
  if (file.size > MAX_BYTES) return new NextResponse("File too large", { status: 413 });
  const ext = ALLOWED.get(file.type);
  if (!ext) return new NextResponse("Unsupported image type", { status: 415 });

  const dir = path.join(assetsDir(params.type, params.slug), "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  const ts = Date.now();
  const name = `${ts}${ext}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, name });
}
