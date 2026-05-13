import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { listItems, type GalleryTab } from "@/lib/gallery";

export const dynamic = "force-dynamic";

const VALID_TABS: GalleryTab[] = ["timeline", "favorites", "trash"];

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tabParam = req.nextUrl.searchParams.get("tab") as GalleryTab | null;
  const tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "timeline";
  const cursor = req.nextUrl.searchParams.get("cursor");
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const albumIdRaw = req.nextUrl.searchParams.get("albumId");
  const tag = req.nextUrl.searchParams.get("tag") || undefined;
  const yearRaw = req.nextUrl.searchParams.get("year");
  const orderRaw = req.nextUrl.searchParams.get("order");
  const from = req.nextUrl.searchParams.get("from") || undefined;
  const to = req.nextUrl.searchParams.get("to") || undefined;
  const minRatingRaw = req.nextUrl.searchParams.get("minRating");
  const limit = limitRaw ? parseInt(limitRaw, 10) : 60;
  const albumId = albumIdRaw ? parseInt(albumIdRaw, 10) : undefined;
  const year = yearRaw ? parseInt(yearRaw, 10) : undefined;
  const minRating = minRatingRaw ? parseInt(minRatingRaw, 10) : undefined;
  const order: "asc" | "desc" | "custom" | undefined =
    orderRaw === "asc"
      ? "asc"
      : orderRaw === "desc"
        ? "desc"
        : orderRaw === "custom"
          ? "custom"
          : undefined;

  const result = listItems(user.id, {
    tab,
    cursor,
    limit,
    albumId,
    tag,
    year,
    from,
    to,
    order,
    minRating,
  });
  return NextResponse.json(result);
}
