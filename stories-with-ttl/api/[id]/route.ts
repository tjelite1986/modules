import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getStory, deleteStory } from "@/lib/stories";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const story = getStory(user.id, id);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(story);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const ok = deleteStory(user.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const io = (globalThis as { _io?: { emit: (e: string, p: unknown) => void } })._io;
  if (io) io.emit("story-deleted", { userId: user.id, storyId: id });

  return NextResponse.json({ deleted: true });
}
