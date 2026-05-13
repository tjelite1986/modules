import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getNotifications, getUnreadCount } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const tokenUser = verifyToken(req);
  if (!tokenUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "30", 10), 100);
  return NextResponse.json({
    items: getNotifications(tokenUser.id, limit),
    unread: getUnreadCount(tokenUser.id),
  });
}
