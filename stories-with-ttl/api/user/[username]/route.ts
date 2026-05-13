import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listStoriesForUser } from "@/lib/stories";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { username: string } },
) {
  const viewer = verifyToken(req);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const target = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(params.username) as { id: number } | undefined;
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    stories: listStoriesForUser(viewer.id, target.id),
  });
}
