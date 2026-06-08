import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { setLayout } from "@/lib/userWidgets";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { order?: unknown };
  if (!Array.isArray(body.order)) {
    return NextResponse.json({ error: "order must be an array" }, { status: 400 });
  }
  const ids = body.order.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  setLayout(user.id, ids);
  return NextResponse.json({ ok: true });
}
