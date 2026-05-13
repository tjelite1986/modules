import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getItem, setTakenAt } from "@/lib/gallery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    itemIds?: unknown;
    taken_at?: unknown;
    shift_ms?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const ids = Array.isArray(body.itemIds)
    ? body.itemIds.filter((x): x is number => typeof x === "number" && Number.isFinite(x))
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No itemIds" }, { status: 400 });
  }

  const hasAbsolute = typeof body.taken_at === "string";
  const hasShift = typeof body.shift_ms === "number" && Number.isFinite(body.shift_ms);
  if (!hasAbsolute && !hasShift) {
    return NextResponse.json(
      { error: "Provide taken_at (ISO string) or shift_ms (number)" },
      { status: 400 },
    );
  }

  let updated = 0;
  const errors: { id: number; error: string }[] = [];

  if (hasAbsolute) {
    const iso = (body.taken_at as string).trim();
    if (Number.isNaN(new Date(iso).getTime())) {
      return NextResponse.json({ error: "Invalid taken_at" }, { status: 400 });
    }
    for (const id of ids) {
      const result = setTakenAt(user.id, id, iso);
      if (result) updated++;
      else errors.push({ id, error: "Not found or invalid" });
    }
  } else {
    const shift = body.shift_ms as number;
    for (const id of ids) {
      const item = getItem(user.id, id);
      if (!item) {
        errors.push({ id, error: "Not found" });
        continue;
      }
      const current = new Date(item.taken_at).getTime();
      if (!Number.isFinite(current)) {
        errors.push({ id, error: "Invalid current date" });
        continue;
      }
      const next = new Date(current + shift).toISOString();
      const result = setTakenAt(user.id, id, next);
      if (result) updated++;
      else errors.push({ id, error: "Update failed" });
    }
  }

  return NextResponse.json({ updated, errors });
}
