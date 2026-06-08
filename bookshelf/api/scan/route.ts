import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { scanFs } from "@/lib/books";
import { extractAllMissing } from "@/lib/bookCovers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const scan = scanFs();
  const covers = await extractAllMissing();
  return NextResponse.json({ ...scan, covers });
}
