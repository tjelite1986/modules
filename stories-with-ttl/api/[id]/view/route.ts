import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { markStoryViewed } from "@/lib/stories";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  markStoryViewed(user.id, id);
  return NextResponse.json({ viewed: true });
}
