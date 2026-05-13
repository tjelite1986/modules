import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { markRead } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tokenUser = verifyToken(req);
  if (!tokenUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  markRead(tokenUser.id, id);
  return NextResponse.json({ ok: true });
}
