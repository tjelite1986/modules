import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { addTagToItem, setLocationName } from "@/lib/gallery";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

let lastFetchAt = 0;

function pickCity(addr: any): string | null {
  if (!addr) return null;
  const candidates = [
    addr.city,
    addr.town,
    addr.village,
    addr.hamlet,
    addr.municipality,
    addr.suburb,
    addr.county,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

async function geocode(
  lat: number,
  lng: number,
): Promise<{ display_name: string; city: string | null; country: string | null }> {
  const wait = Math.max(0, 1100 - (Date.now() - lastFetchAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`,
      {
        headers: {
          "User-Agent": "EliteGallery/1.0 (personal use)",
          "Accept-Language": "en,sv",
        },
      },
    );
    if (!res.ok) return { display_name: "", city: null, country: null };
    const data = await res.json();
    return {
      display_name: typeof data.display_name === "string" ? data.display_name : "",
      city: pickCity(data.address),
      country:
        typeof data.address?.country === "string" ? data.address.country : null,
    };
  } catch {
    return { display_name: "", city: null, country: null };
  }
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(limitRaw ? parseInt(limitRaw, 10) : 100, 1), 500);

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, latitude, longitude FROM gallery_items
        WHERE user_id = ? AND is_deleted = 0
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          AND (location_name IS NULL OR location_name = '')
        LIMIT ?`,
    )
    .all(user.id, limit) as {
    id: number;
    latitude: number;
    longitude: number;
  }[];

  let processed = 0;
  let tagged = 0;
  const errors: { id: number; error: string }[] = [];

  for (const row of rows) {
    try {
      const r = await geocode(row.latitude, row.longitude);
      if (r.display_name) {
        setLocationName(user.id, row.id, r.display_name);
        processed += 1;
        if (r.city && addTagToItem(user.id, row.id, r.city)) tagged += 1;
        if (r.country && addTagToItem(user.id, row.id, r.country)) tagged += 1;
      } else {
        errors.push({ id: row.id, error: "no result" });
      }
    } catch (err: any) {
      errors.push({ id: row.id, error: err?.message || "unknown" });
    }
  }

  const remainingRow = db
    .prepare(
      `SELECT COUNT(*) AS c FROM gallery_items
        WHERE user_id = ? AND is_deleted = 0
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          AND (location_name IS NULL OR location_name = '')`,
    )
    .get(user.id) as { c: number };

  return NextResponse.json({
    processed,
    tagged,
    errors,
    remaining: remainingRow.c,
  });
}
