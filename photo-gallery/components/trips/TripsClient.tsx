"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plane,
  Play,
  Pencil,
  Check,
  X,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Image as ImageIcon,
} from "lucide-react";
import { mediaToken } from "@/lib/mediaToken";

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

interface TripItem {
  id: number;
  storage_key: string;
  kind: "image" | "video";
  taken_at: string;
}

function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") ?? "";
}

function thumbUrl(storage_key: string) {
  return `/api/gallery/thumb/${storage_key}?t=${encodeURIComponent(mediaToken())}`;
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

export default function TripsClient() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [coverPickerId, setCoverPickerId] = useState<number | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/gallery/trips", {
      headers: { Authorization: `Bearer ${authToken()}` },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setTrips(data.trips || []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  async function runRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/gallery/trips/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
        setFlash(
          data.created > 0
            ? `${data.created} new trip${data.created === 1 ? "" : "s"} detected.`
            : "No new trips found.",
        );
      }
    } finally {
      setRefreshing(false);
    }
  }

  function startEdit(trip: Trip) {
    setEditingId(trip.id);
    setEditDraft(trip.has_custom_title ? trip.title : "");
    setApplyToAll(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
    setApplyToAll(false);
  }

  async function saveTitle(trip: Trip) {
    setSavingId(trip.id);
    try {
      const trimmed = editDraft.trim();
      const body =
        applyToAll && trimmed.length > 0
          ? { title: trimmed, apply_to_all: true }
          : { title: trimmed.length > 0 ? trimmed : null };
      const res = await fetch(`/api/gallery/trips/${trip.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        if (applyToAll && trimmed.length > 0) {
          const data = await res.json().catch(() => null);
          const n = data?.affected ?? 0;
          setFlash(
            `Renamed ${n} trip${n === 1 ? "" : "s"} at "${data?.auto_title ?? trip.auto_title}" — future trips at this place will use "${trimmed}" too.`,
          );
        }
        cancelEdit();
        await load();
      }
    } finally {
      setSavingId(null);
    }
  }

  async function toggleHidden(trip: Trip) {
    await fetch(`/api/gallery/trips/${trip.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${authToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hidden: !trip.hidden }),
    });
    await load();
  }

  async function deleteTrip(trip: Trip) {
    if (
      !confirm(
        `Delete trip "${trip.title}"? The ${trip.count} photos stay in the gallery.`,
      )
    )
      return;
    await fetch(`/api/gallery/trips/${trip.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken()}` },
    });
    await load();
  }

  async function setCover(tripId: number, itemId: number | null) {
    await fetch(`/api/gallery/trips/${tripId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${authToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cover_item_id: itemId }),
    });
    setCoverPickerId(null);
    await load();
  }

  const visibleTrips = useMemo(
    () => trips.filter((t) => showHidden || !t.hidden),
    [trips, showHidden],
  );
  const hiddenCount = useMemo(
    () => trips.filter((t) => t.hidden).length,
    [trips],
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/gallery"
          className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
          aria-label="Back to gallery"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Plane className="w-6 h-6 text-violet-300" /> Trips
        </h1>
        <span className="text-sm text-gray-500">
          {loading
            ? "Loading…"
            : `${visibleTrips.length} ${visibleTrips.length === 1 ? "trip" : "trips"}${
                hiddenCount > 0 && !showHidden ? ` (${hiddenCount} hidden)` : ""
              }`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden((v) => !v)}
              className="px-2.5 py-1.5 rounded border border-gray-700 hover:border-gray-500 text-xs text-gray-300 flex items-center gap-1.5"
            >
              {showHidden ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" /> Hide hidden
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" /> Show hidden
                </>
              )}
            </button>
          )}
          <button
            onClick={runRefresh}
            disabled={refreshing}
            className="px-2.5 py-1.5 rounded border border-gray-700 hover:border-violet-500 text-xs text-gray-300 hover:text-violet-200 flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing…" : "Detect new trips"}
          </button>
        </div>
      </div>

      {flash && (
        <div className="rounded-md border border-violet-700/50 bg-violet-950/30 px-3 py-2 text-xs text-violet-200">
          {flash}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : visibleTrips.length === 0 ? (
        <div className="rounded-md border border-gray-800 p-8 text-center text-gray-400 text-sm space-y-2">
          <div>No trips detected yet.</div>
          <div className="text-xs text-gray-500">
            Trips are clusters of 3+ geotagged photos taken within 36 hours and
            30 km of each other. Upload more geotagged photos or run the place
            backfill on the Tags page, then click &ldquo;Detect new trips&rdquo;.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleTrips.map((t) => (
            <div
              key={t.id}
              className={`group rounded-lg overflow-hidden bg-gray-900 border ${
                t.hidden ? "border-gray-800 opacity-60" : "border-gray-800 hover:border-violet-500/50"
              } transition-colors flex flex-col`}
            >
              <Link
                href={`/gallery/trips/${t.id}`}
                className="block aspect-[4/3] bg-gray-800 relative"
              >
                <img
                  src={thumbUrl(t.cover_storage_key)}
                  alt={t.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                {t.cover_kind === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent">
                    <Play className="w-8 h-8 text-white drop-shadow" />
                  </div>
                )}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-xs text-white">
                  {t.count} photos
                </div>
                {t.hidden && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-xs text-gray-300 flex items-center gap-1">
                    <EyeOff className="w-3 h-3" /> hidden
                  </div>
                )}
              </Link>
              <div className="p-3 space-y-1.5">
                {editingId === t.id ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        type="text"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTitle(t);
                          else if (e.key === "Escape") cancelEdit();
                        }}
                        placeholder={t.auto_title ?? "Trip name"}
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-gray-800 border border-gray-700 focus:border-violet-500 outline-none text-sm text-white"
                      />
                      <button
                        onClick={() => saveTitle(t)}
                        disabled={savingId === t.id}
                        className="p-1 rounded hover:bg-gray-800 text-violet-300 disabled:opacity-50"
                        aria-label="Save"
                      >
                        {savingId === t.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1 rounded hover:bg-gray-800 text-gray-400"
                        aria-label="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {t.auto_title && (
                      <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={applyToAll}
                          onChange={(e) => setApplyToAll(e.target.checked)}
                          className="accent-violet-500"
                        />
                        <span className="truncate">
                          Apply to all trips at &ldquo;{t.auto_title}&rdquo; (now and future)
                        </span>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    <Link
                      href={`/gallery/trips/${t.id}`}
                      className="flex-1 min-w-0 hover:text-violet-200"
                    >
                      <div className="text-sm font-medium text-white truncate">
                        {t.title}
                      </div>
                      {t.has_custom_title && t.auto_title && t.auto_title !== t.title && (
                        <div className="text-[10px] text-gray-500 truncate">
                          auto: {t.auto_title}
                        </div>
                      )}
                    </Link>
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      aria-label="Rename trip"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="text-xs text-gray-400">
                  {fmtDateRange(t.start_at, t.end_at)}
                </div>
                <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() =>
                      setCoverPickerId(coverPickerId === t.id ? null : t.id)
                    }
                    className="px-1.5 py-1 rounded hover:bg-gray-800 text-[11px] text-gray-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    <ImageIcon className="w-3 h-3" /> Cover
                  </button>
                  <button
                    onClick={() => toggleHidden(t)}
                    className="px-1.5 py-1 rounded hover:bg-gray-800 text-[11px] text-gray-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    {t.hidden ? (
                      <>
                        <Eye className="w-3 h-3" /> Show
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" /> Hide
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => deleteTrip(t)}
                    className="ml-auto px-1.5 py-1 rounded hover:bg-gray-800 text-[11px] text-gray-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
              {coverPickerId === t.id && (
                <CoverPicker
                  tripId={t.id}
                  currentCoverItemId={t.cover_item_id}
                  hasCustomCover={t.has_custom_cover}
                  onPick={(itemId) => setCover(t.id, itemId)}
                  onReset={() => setCover(t.id, null)}
                  onClose={() => setCoverPickerId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CoverPicker({
  tripId,
  currentCoverItemId,
  hasCustomCover,
  onPick,
  onReset,
  onClose,
}: {
  tripId: number;
  currentCoverItemId: number;
  hasCustomCover: boolean;
  onPick: (itemId: number) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<TripItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/gallery/trips/${tripId}/items`, {
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
  }, [tripId]);

  return (
    <div className="border-t border-gray-800 bg-gray-950/60 p-2 space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span>Pick cover</span>
        <div className="flex items-center gap-1">
          {hasCustomCover && (
            <button
              onClick={onReset}
              className="px-1.5 py-0.5 rounded hover:bg-gray-800 text-gray-400 hover:text-violet-300"
            >
              Reset
            </button>
          )}
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-gray-800 text-gray-500 hover:text-white"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1 max-h-40 overflow-y-auto">
          {(items ?? []).map((it) => (
            <button
              key={it.id}
              onClick={() => onPick(it.id)}
              className={`aspect-square rounded overflow-hidden bg-gray-800 border ${
                it.id === currentCoverItemId
                  ? "border-violet-400 ring-1 ring-violet-400"
                  : "border-transparent hover:border-violet-500/60"
              }`}
            >
              <img
                src={thumbUrl(it.storage_key)}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
