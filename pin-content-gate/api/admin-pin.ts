import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";
import { PIN_GATE_CONFIG } from "@/lib/pin-gate";

/**
 * GET  /api/admin/gate-pin → { hasPin: boolean }
 * POST /api/admin/gate-pin → set or replace the PIN. Body: { pin: string }
 *
 * Both endpoints require an admin session.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { pin } = body as { pin?: string };

  if (!pin || pin.length < PIN_GATE_CONFIG.minPinLength) {
    return NextResponse.json(
      { error: `PIN must be at least ${PIN_GATE_CONFIG.minPinLength} characters` },
      { status: 400 },
    );
  }

  const hash = await bcrypt.hash(pin, PIN_GATE_CONFIG.bcryptRounds);
  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(PIN_GATE_CONFIG.pinHashKey, hash);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(PIN_GATE_CONFIG.pinHashKey);
  return NextResponse.json({ hasPin: !!row });
}
