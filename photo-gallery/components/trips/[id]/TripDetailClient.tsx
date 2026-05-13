"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpAZ,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Pencil,
  Play,
  RefreshCw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import Lightbox from "../../Lightbox";
import { thumbUrl, previewUrl, originalUrl } from "../../GalleryClient";
import type { GalleryItem } from "../../types";

interface Trip {
  id: number;
  start_at: string;
  end_at: string;
  count: number;
  center_lat: number;
  center_lng: number;
  title: string;
  auto_title: string | null;
  has_custom_title: boolean;
  hidden: boolean;
  cover_item_id: number;
  cover_storage_key: string;
  cover_kind: "image" | "video";
  has_custom_cover: boolean;
  item_ids: number[];
}

function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") ?? "";
}

function authHeaders() {
  return { Authorization: `Bearer ${authToken()}` };
}

function fileUrlForLightbox(item: GalleryItem, variant: "preview" | "file") {
  return variant === "preview" ? previewUrl(item) : originalUrl(item);
}

function fmtDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  if (sameDay) return s.toLocaleDateString(undefined, opts);
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameYear) {
    return `${s.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${e.toLocaleDateString(undefined, opts)}`;
  }
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

export default function TripDetailClient({ tripId }: { tripId: number }) {
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [editingName, setEditingName] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(`trip_sort_${tripId}`);
    if (stored === "asc" || stored === "desc") setSortOrder(stored);
  }, [tripId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`trip_sort_${tripId}`, sortOrder);
  }, [tripId, sortOrder]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/gallery/tags", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setAllTags((data.tags || []).map((t: { tag: string }) => t.tag));
      }
    })();
  }, []);

  const load = useCallback(async () => {
    const [tRes, iRes] = await Promise.all([
      fetch(`/api/gallery/trips/${tripId}`, {
        headers: authHeaders(),
        cache: "no-store",
      }),
      fetch(`/api/gallery/trips/${tripId}/items?order=${sortOrder}`, {
        headers: authHeaders(),
        cache: "no-store",
      }),
    ]);
    if (tRes.ok) setTrip(await tRes.json());
    if (iRes.ok) {
      const data = await iRes.json();
      setItems(data.items || []);
    }
    setLoading(false);
  }, [tripId, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const updateItemInPlace = (updated: GalleryItem) => {
    setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const removeItemFromList = (id: number) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const onToggleFavorite = async (item: GalleryItem) => {
    const next = item.is_favorite === 1 ? false : true;
    const res = await fetch(`/api/gallery/items/${item.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: next }),
    });
    if (res.ok) updateItemInPlace(await res.json());
  };

  const onSoftDelete = async (item: GalleryItem) => {
    const res = await fetch(`/api/gallery/items/${item.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      removeItemFromList(item.id);
      if (lightboxIndex !== null && lightboxIndex >= items.length - 1) {
        setLightboxIndex(null);
      }
    }
  };

  async function startEdit() {
    if (!trip) return;
    setRenameValue(trip.has_custom_title ? trip.title : "");
    setApplyToAll(false);
    setEditingName(true);
  }

  async function saveName() {
    if (!trip) return;
    setSaving(true);
    try {
      const trimmed = renameValue.trim();
      const body =
        applyToAll && trimmed.length > 0
          ? { title: trimmed, apply_to_all: true }
          : { title: trimmed.length > 0 ? trimmed : null };
      const res = await fetch(`/api/gallery/trips/${trip.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        if (applyToAll && trimmed.length > 0) {
          const data = await res.json().catch(() => null);
          const n = data?.affected ?? 0;
          setFlash(
            `Renamed ${n} trip${n === 1 ? "" : "s"} at "${data?.auto_title ?? trip.auto_title}" — future trips will use "${trimmed}" too.`,
          );
        }
        setEditingName(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleHidden() {
    if (!trip) return;
    const res = await fetch(`/api/gallery/trips/${trip.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: !trip.hidden }),
    });
    if (res.ok) await load();
  }

  async function deleteThisTrip() {
    if (!trip) return;
    if (
      !confirm(
        `Delete trip "${trip.title}"? The ${trip.count} photos stay in the gallery.`,
      )
    )
      return;
    const res = await fetch(`/api/gallery/trips/${trip.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) router.push("/gallery/trips");
  }

  async function setCover(itemId: number) {
    if (!trip) return;
    const res = await fetch(`/api/gallery/trips/${trip.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ cover_item_id: itemId }),
    });
    if (res.ok) {
      setFlash("Cover updated.");
      await load();
    }
  }

  if (loading && !trip) {
    return (
      <div className="text-gray-400 text-sm flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="rounded-md border border-gray-800 p-8 text-center text-gray-400 text-sm space-y-2">
        <div>Trip not found.</div>
        <Link href="/gallery/trips" className="text-violet-300 underline">
          Back to trips
        </Link>
      </div>
    );
  }

  const mapHref = `/gallery/map?lat=${trip.center_lat}&lng=${trip.center_lng}`;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/gallery/trips"
          className="p-1.5 rounded hover:bg-gray-800 text-gray-300 flex items-center gap-1"
          aria-label="Back to trips"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Trips</span>
        </Link>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    else if (e.key === "Escape") setEditingName(false);
                  }}
                  placeholder={trip.auto_title ?? "Trip name"}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded bg-gray-800 border border-gray-700 focus:border-violet-500 outline-none text-white"
                />
                <button
                  onClick={saveName}
                  disabled={saving}
                  className="p-1.5 rounded hover:bg-gray-800 text-violet-300 disabled:opacity-50"
                  aria-label="Save"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="p-1.5 rounded hover:bg-gray-800 text-gray-400"
                  aria-label="Cancel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {trip.auto_title && (
                <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    className="accent-violet-500"
                  />
                  <span className="truncate">
                    Apply to all trips at &ldquo;{trip.auto_title}&rdquo; (now and future)
                  </span>
                </label>
              )}
            </div>
          ) : (
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2 min-w-0">
              <span className="truncate">{trip.title}</span>
              <button
                onClick={startEdit}
                className="p-1 rounded hover:bg-gray-800 text-gray-400 shrink-0"
                aria-label="Rename trip"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {trip.hidden && (
                <span className="px-1.5 py-0.5 rounded-full bg-gray-800 text-[11px] text-gray-400 flex items-center gap-1">
                  <EyeOff className="w-3 h-3" /> hidden
                </span>
              )}
            </h1>
          )}
        </div>
        <button
          onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
          className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-700 text-gray-200 hover:border-gray-500 text-sm flex items-center gap-1"
          title={
            sortOrder === "desc"
              ? "Newest first — click to flip"
              : "Oldest first — click to flip"
          }
        >
          {sortOrder === "desc" ? (
            <>
              <ArrowDownAZ className="w-4 h-4" /> Newest
            </>
          ) : (
            <>
              <ArrowUpAZ className="w-4 h-4" /> Oldest
            </>
          )}
        </button>
        <Link
          href={mapHref}
          className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-700 text-gray-200 hover:border-violet-500 text-sm flex items-center gap-1"
        >
          <MapPin className="w-4 h-4" /> Map
        </Link>
        <button
          onClick={toggleHidden}
          className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-700 text-gray-200 hover:border-amber-500 text-sm flex items-center gap-1"
        >
          {trip.hidden ? (
            <>
              <Eye className="w-4 h-4" /> Show
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4" /> Hide
            </>
          )}
        </button>
        <button
          onClick={deleteThisTrip}
          className="px-3 py-1.5 rounded-md bg-red-600/20 text-red-300 border border-red-600/40 text-sm hover:bg-red-600/30 flex items-center gap-1"
        >
          <Trash2 className="w-4 h-4" /> Delete trip
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
        <span>{fmtDateRange(trip.start_at, trip.end_at)}</span>
        <span className="text-gray-600">•</span>
        <span>
          {items.length} {items.length === 1 ? "photo" : "photos"}
        </span>
        {trip.has_custom_title && trip.auto_title && trip.auto_title !== trip.title && (
          <>
            <span className="text-gray-600">•</span>
            <span className="text-xs text-gray-500">
              auto: {trip.auto_title}
            </span>
          </>
        )}
        {trip.has_custom_cover && (
          <>
            <span className="text-gray-600">•</span>
            <button
              onClick={async () => {
                await fetch(`/api/gallery/trips/${trip.id}`, {
                  method: "PATCH",
                  headers: {
                    ...authHeaders(),
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ cover_item_id: null }),
                });
                await load();
              }}
              className="text-xs text-gray-400 hover:text-violet-300 underline"
            >
              Reset cover
            </button>
          </>
        )}
      </div>

      {flash && (
        <div className="rounded-md border border-violet-700/50 bg-violet-950/30 px-3 py-2 text-xs text-violet-200">
          {flash}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-gray-800 p-8 text-center text-gray-400 text-sm">
          No photos in this trip.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
          {items.map((it, idx) => (
            <div key={it.id} className="relative group">
              <button
                onClick={() => setLightboxIndex(idx)}
                className={`relative aspect-square rounded overflow-hidden bg-gray-900 w-full ${
                  trip.cover_item_id === it.id
                    ? "ring-2 ring-violet-400"
                    : ""
                }`}
              >
                <img
                  src={thumbUrl(it)}
                  alt={it.filename}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                {it.kind === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent">
                    <Play className="w-7 h-7 text-white drop-shadow" />
                  </div>
                )}
                {it.is_favorite === 1 && (
                  <Star className="absolute top-1 right-1 w-4 h-4 fill-yellow-400 text-yellow-400 drop-shadow" />
                )}
                {trip.cover_item_id === it.id && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-violet-600/90 text-[10px] text-white">
                    Cover
                  </div>
                )}
              </button>
              {trip.cover_item_id !== it.id && (
                <button
                  onClick={() => setCover(it.id)}
                  className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full bg-black/70 hover:bg-violet-600/90 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Set as cover"
                >
                  Set cover
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && items[lightboxIndex] && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
          onToggleFavorite={onToggleFavorite}
          onSoftDelete={onSoftDelete}
          fileUrl={fileUrlForLightbox}
          allTags={allTags}
          authHeaders={authHeaders}
          onSetAsCover={(it) => setCover(it.id)}
          isCover={(it) => trip.cover_item_id === it.id}
          onRotated={(updated) => updateItemInPlace(updated)}
        />
      )}

      <RefreshLink />
    </div>
  );
}

function RefreshLink() {
  return (
    <div className="pt-4 text-center">
      <Link
        href="/gallery/trips"
        className="text-xs text-gray-500 hover:text-violet-300 inline-flex items-center gap-1"
      >
        <RefreshCw className="w-3 h-3" /> Back to all trips
      </Link>
    </div>
  );
}
