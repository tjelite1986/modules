import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { markAllRead } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const tokenUser = verifyToken(req);
  if (!tokenUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  markAllRead(tokenUser.id);
  return NextResponse.json({ ok: true });
}
