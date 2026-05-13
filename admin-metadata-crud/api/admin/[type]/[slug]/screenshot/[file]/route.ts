import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { isValidType, isValidSlug, assetsDir } from "@/lib/store";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { type: string; slug: string; file: string } },
) {
  const guard = await requireAdmin();
  if (guard) return guard;
  if (!isValidType(params.type)) return new NextResponse("Bad type", { status: 400 });
  if (!isValidSlug(params.slug)) return new NextResponse("Bad slug", { status: 400 });
  const file = decodeURIComponent(params.file);
  if (!SAFE_NAME.test(file)) return new NextResponse("Bad file", { status: 400 });

  const base = path.join(assetsDir(params.type, params.slug), "screenshots");
  const filePath = path.resolve(path.join(base, file));
  if (!filePath.startsWith(path.resolve(base) + path.sep)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return NextResponse.json({ ok: true });
}
