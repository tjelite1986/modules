import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { addTagToItem, getItem, setLocationName } from "@/lib/gallery";

export const dynamic = "force-dynamic";

interface Reverse {
  display_name: string;
  city: string | null;
  country: string | null;
}

interface CacheEntry extends Reverse {
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
let lastFetchAt = 0;

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

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

async function nominatim(lat: number, lng: number): Promise<Reverse> {
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
    const display_name = typeof data.display_name === "string" ? data.display_name : "";
    const city = pickCity(data.address);
    const country = typeof data.address?.country === "string" ? data.address.country : null;
    return { display_name, city, country };
  } catch {
    return { display_name: "", city: null, country: null };
  }
}

function applyTags(userId: number, itemId: number, r: Reverse) {
  if (r.city) addTagToItem(userId, itemId, r.city);
  if (r.country) addTagToItem(userId, itemId, r.country);
}

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") || "");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") || "");
  const itemIdRaw = req.nextUrl.searchParams.get("itemId");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid coords" }, { status: 400 });
  }

  const itemId = itemIdRaw ? parseInt(itemIdRaw, 10) : null;
  if (itemId) {
    const item = getItem(user.id, itemId);
    if (item && item.location_name) {
      return NextResponse.json({ display_name: item.location_name });
    }
  }

  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    if (itemId && hit.display_name) {
      setLocationName(user.id, itemId, hit.display_name);
      applyTags(user.id, itemId, hit);
    }
    return NextResponse.json({
      display_name: hit.display_name,
      city: hit.city,
      country: hit.country,
    });
  }

  const r = await nominatim(lat, lng);
  if (r.display_name) cache.set(key, { ...r, ts: Date.now() });
  if (itemId && r.display_name) {
    setLocationName(user.id, itemId, r.display_name);
    applyTags(user.id, itemId, r);
  }
  return NextResponse.json(r);
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const itemIdRaw = req.nextUrl.searchParams.get("itemId");
  const itemId = itemIdRaw ? parseInt(itemIdRaw, 10) : null;
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  const item = getItem(user.id, itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.latitude == null || item.longitude == null) {
    return NextResponse.json({ error: "No GPS" }, { status: 400 });
  }
  const key = cacheKey(item.latitude, item.longitude);
  let r: Reverse;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    r = { display_name: hit.display_name, city: hit.city, country: hit.country };
  } else {
    r = await nominatim(item.latitude, item.longitude);
    if (r.display_name) cache.set(key, { ...r, ts: Date.now() });
  }
  if (r.display_name) {
    setLocationName(user.id, itemId, r.display_name);
    applyTags(user.id, itemId, r);
  }
  return NextResponse.json(r);
}
