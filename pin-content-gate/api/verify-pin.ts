import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";
import { PIN_GATE_CONFIG } from "@/lib/pin-gate";

/**
 * POST /api/gate/verify-pin
 * Body: { pin: string }
 *
 * On success, sets an httpOnly session cookie marking the gate as unlocked
 * for the rest of this session.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { pin } = body as { pin?: string };

  if (!pin) {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(PIN_GATE_CONFIG.pinHashKey) as { value: string } | undefined;

  if (!row) {
    return NextResponse.json({ error: "No PIN has been set" }, { status: 400 });
  }

  const ok = await bcrypt.compare(pin, row.value);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(PIN_GATE_CONFIG.cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // session cookie (no maxAge) — user must re-enter PIN after closing the browser
  });
  return response;
}
