import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActivityForUser } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const tokenUser = verifyToken(req);
  if (!tokenUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const username = req.nextUrl.searchParams.get("user");
  if (!username) return NextResponse.json({ error: "?user=<username> required" }, { status: 400 });

  const db = getDb();
  const dbUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as
    | { id: number }
    | undefined;
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "30", 10), 100);
  const items = getActivityForUser(dbUser.id, limit);
  return NextResponse.json({ items });
}
