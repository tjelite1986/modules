import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { rotateItem } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const raw = Number(body.degrees);
  if (![90, 180, 270, -90].includes(raw)) {
    return NextResponse.json({ error: "Invalid degrees" }, { status: 400 });
  }
  const degrees = (raw === -90 ? 270 : raw) as 90 | 180 | 270;
  const updated = await rotateItem(user.id, id, degrees);
  if (!updated) {
    return NextResponse.json({ error: "Rotation failed" }, { status: 500 });
  }
  return NextResponse.json(updated);
}
