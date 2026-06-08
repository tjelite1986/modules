import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  getLayout,
  resetLayout,
  setLayout,
  type DashboardLayout,
} from "@/lib/dashboardLayout";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ layout: getLayout(user.id) });
}

export async function PUT(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { layout?: unknown } | null;
  if (!body || typeof body !== "object" || !body.layout) {
    return NextResponse.json({ error: "layout required" }, { status: 400 });
  }
  const stored = setLayout(user.id, body.layout as DashboardLayout);
  return NextResponse.json({ layout: stored });
}

export async function DELETE(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  resetLayout(user.id);
  return NextResponse.json({ layout: null });
}
