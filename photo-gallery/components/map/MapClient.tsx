"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Flame, Loader2, MapPin, MapPinned } from "lucide-react";
import { mediaToken } from "@/lib/mediaToken";

const MapLeaflet = dynamic(() => import("./MapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading map…
    </div>
  ),
});

export interface GeoPoint {
  id: number;
  storage_key: string;
  filename: string;
  kind: "image" | "video";
  taken_at: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
}

function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") ?? "";
}

export default function MapClient() {
  const [items, setItems] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"markers" | "heat">("markers");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("gallery_map_mode");
    if (stored === "markers" || stored === "heat") setMode(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("gallery_map_mode", mode);
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/gallery/locations", {
        headers: { Authorization: `Bearer ${authToken()}` },
        cache: "no-store",
      });
      if (res.ok && !cancelled) {
        const data = await res.json();
        setItems(data.items || []);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-3 h-[calc(100vh-9rem)] flex flex-col">
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
        <Link
          href="/gallery"
          className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
          aria-label="Back to gallery"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <MapPin className="w-6 h-6 text-violet-300" /> Map
        </h1>
        <span className="text-sm text-gray-500">
          {loading
            ? "Loading…"
            : `${items.length} ${items.length === 1 ? "geotagged photo" : "geotagged photos"}`}
        </span>
        <div className="ml-auto flex bg-gray-900 border border-gray-700 rounded-md overflow-hidden text-sm">
          <button
            onClick={() => setMode("markers")}
            className={`px-3 py-1.5 flex items-center gap-1 ${
              mode === "markers"
                ? "bg-violet-600/30 text-violet-200"
                : "text-gray-400 hover:text-gray-200"
            }`}
            title="Show photo markers with clustering"
          >
            <MapPinned className="w-4 h-4" /> Markers
          </button>
          <button
            onClick={() => setMode("heat")}
            className={`px-3 py-1.5 flex items-center gap-1 ${
              mode === "heat"
                ? "bg-violet-600/30 text-violet-200"
                : "text-gray-400 hover:text-gray-200"
            }`}
            title="Show density heatmap"
          >
            <Flame className="w-4 h-4" /> Heat
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-gray-800 bg-gray-900 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2 px-4 text-center">
            <MapPin className="w-10 h-10 text-gray-600" />
            <div>No geotagged photos yet.</div>
            <div className="text-xs text-gray-500">
              Photos with GPS data in their EXIF metadata will appear here.
              Open a photo&apos;s info panel (i) to backfill GPS for older
              uploads.
            </div>
          </div>
        ) : (
          <MapLeaflet items={items} authToken={mediaToken()} mode={mode} />
        )}
      </div>
    </div>
  );
}
