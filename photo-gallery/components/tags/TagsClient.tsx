"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowLeft, CalendarRange, Check, Loader2, MapPin, Pencil, Search, Tag, Trash2, X } from "lucide-react";
import type { TagSummary } from "../types";

function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") ?? "";
}

function authHeaders() {
  return { Authorization: `Bearer ${authToken()}` };
}

function tagThumbUrl(t: TagSummary) {
  if (!t.cover_storage_key) return null;
  return `/api/gallery/thumb/${t.cover_storage_key}?t=${encodeURIComponent(authToken())}`;
}

export default function TagsClient() {
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [sortMode, setSortMode] = useState<"count" | "name">("count");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("tags_sort");
    if (stored === "count" || stored === "name") setSortMode(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("tags_sort", sortMode);
  }, [sortMode]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const res = await fetch("/api/gallery/tags", {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setTags(data.tags || []);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const renameTag = async (oldTag: string) => {
    const next = renameValue.trim();
    if (!next || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/gallery/tags/${encodeURIComponent(oldTag)}`,
        {
          method: "PATCH",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ rename: next }),
        },
      );
      if (res.ok) {
        setRenaming(null);
        setRenameValue("");
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const runYearBackfill = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gallery/backfill-year-tags", {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Added year tags to ${data.added} new item(s) (out of ${data.updated}).`);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const runPlaceBackfill = async () => {
    if (busy) return;
    if (
      !confirm(
        "Reverse-geocode every photo with GPS data and add place tags? This may take several minutes (rate-limited to 1 req/sec).",
      )
    )
      return;
    setBusy(true);
    try {
      let total = 0;
      let totalTagged = 0;
      let remaining = Infinity;
      while (remaining > 0) {
        const res = await fetch(
          "/api/gallery/backfill-place-tags?limit=100",
          { method: "POST", headers: authHeaders() },
        );
        if (!res.ok) break;
        const data = await res.json();
        total += data.processed || 0;
        totalTagged += data.tagged || 0;
        remaining = data.remaining ?? 0;
        if ((data.processed || 0) === 0) break;
      }
      alert(`Geocoded ${total} photo(s), added ${totalTagged} place tag(s).`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const deleteTag = async (tag: string, count: number) => {
    if (!confirm(`Remove tag "${tag}" from ${count} item${count === 1 ? "" : "s"}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/gallery/tags/${encodeURIComponent(tag)}`,
        { method: "DELETE", headers: authHeaders() },
      );
      if (res.ok) await refresh();
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q ? tags.filter((t) => t.tag.includes(q)) : tags;
    const sorted = filtered.slice();
    if (sortMode === "name") {
      sorted.sort((a, b) => a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" }));
    } else {
      sorted.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    }
    return sorted;
  }, [tags, filter, sortMode]);

  const total = tags.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/gallery"
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
            aria-label="Back to gallery"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-violet-300" /> Tags
          </h1>
          <span className="text-sm text-gray-500">
            {tags.length} {tags.length === 1 ? "tag" : "tags"}
            {total > 0 ? ` · ${total} tagged items` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={runYearBackfill}
            disabled={busy}
            className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-700 text-gray-200 hover:border-violet-400 text-sm flex items-center gap-1 disabled:opacity-50"
            title="Add a year tag (e.g. 2024) to every photo based on its taken_at date"
          >
            <CalendarRange className="w-4 h-4" />
            Auto-tag years
          </button>
          <button
            onClick={runPlaceBackfill}
            disabled={busy}
            className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-700 text-gray-200 hover:border-violet-400 text-sm flex items-center gap-1 disabled:opacity-50"
            title="Reverse-geocode GPS and add city/country tags (1 req/sec)"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MapPin className="w-4 h-4" />
            )}
            Auto-tag places
          </button>
          <button
            onClick={() => setSortMode((m) => (m === "count" ? "name" : "count"))}
            className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-700 text-gray-200 hover:border-violet-400 text-sm flex items-center gap-1"
            title={
              sortMode === "count"
                ? "Most used first — click to sort alphabetically"
                : "Alphabetical — click to sort by usage"
            }
          >
            {sortMode === "count" ? (
              <>
                <ArrowDownWideNarrow className="w-4 h-4" /> Most used
              </>
            ) : (
              <>
                <ArrowDownAZ className="w-4 h-4" /> A–Z
              </>
            )}
          </button>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter tags…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-md pl-7 pr-3 py-1.5 text-sm text-white w-56 focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading tags…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-md border border-gray-800 p-8 text-center text-gray-400 text-sm">
          {filter
            ? `No tags match "${filter}".`
            : "No tags yet. Open a photo and add a tag to get started."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {visible.map((t) => {
            const cover = tagThumbUrl(t);
            const isRenaming = renaming === t.tag;
            return (
              <div
                key={t.tag}
                className="group rounded-lg overflow-hidden bg-gray-900 border border-gray-800 hover:border-violet-500/50 transition-colors relative"
              >
                <Link
                  href={`/gallery?tag=${encodeURIComponent(t.tag)}`}
                  className="block"
                  onClick={(e) => {
                    if (isRenaming) e.preventDefault();
                  }}
                >
                  <div className="aspect-square bg-gray-800 relative">
                    {cover ? (
                      <img
                        src={cover}
                        alt={t.tag}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tag className="w-10 h-10 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      {isRenaming ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.preventDefault()}
                        >
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                renameTag(t.tag);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setRenaming(null);
                              }
                            }}
                            onClick={(e) => e.preventDefault()}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-violet-400"
                          />
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              renameTag(t.tag);
                            }}
                            disabled={busy}
                            className="p-1 rounded bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                            aria-label="Save"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setRenaming(null);
                            }}
                            className="p-1 rounded text-gray-300 hover:bg-gray-700"
                            aria-label="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-white font-medium truncate">
                            #{t.tag}
                          </div>
                          <div className="text-xs text-gray-300">
                            {t.count} {t.count === 1 ? "item" : "items"}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
                {!isRenaming && (
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRenaming(t.tag);
                        setRenameValue(t.tag);
                      }}
                      className="p-1.5 rounded bg-black/70 hover:bg-black text-white"
                      aria-label="Rename tag"
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteTag(t.tag, t.count);
                      }}
                      className="p-1.5 rounded bg-black/70 hover:bg-red-600 text-white"
                      aria-label="Delete tag"
                      title="Delete tag"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
