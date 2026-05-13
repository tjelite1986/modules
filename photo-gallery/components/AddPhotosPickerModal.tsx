"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckSquare, Loader2, Play, Square, X } from "lucide-react";
import type { GalleryItem, ListResult } from "./types";
import { thumbUrl } from "./GalleryClient";

function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") ?? "";
}

function authHeaders() {
  return { Authorization: `Bearer ${authToken()}` };
}

function dateGroupKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function dateGroupLabel(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface Props {
  title?: string;
  excludeIds?: number[];
  onClose: () => void;
  onSubmit: (itemIds: number[]) => Promise<void> | void;
  submitLabel?: (n: number) => string;
}

export default function AddPhotosPickerModal({
  title = "Add photos",
  excludeIds,
  onClose,
  onSubmit,
  submitLabel,
}: Props) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const excluded = new Set(excludeIds || []);

  const load = useCallback(
    async (reset: boolean) => {
      if (loading) return;
      if (!reset && cursor === null && items.length > 0) return;
      setLoading(true);
      const params = new URLSearchParams({ tab: "timeline", limit: "60" });
      if (!reset && cursor) params.set("cursor", cursor);
      try {
        const res = await fetch(`/api/gallery/items?${params.toString()}`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (res.ok) {
          const data: ListResult = await res.json();
          setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
          setCursor(data.nextCursor);
        }
      } finally {
        setLoading(false);
      }
    },
    [cursor, loading, items.length],
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && cursor && !loading) {
        load(false);
      }
    });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [cursor, loading, load]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visible = items.filter((it) => !excluded.has(it.id));
  const groups = new Map<string, GalleryItem[]>();
  for (const it of visible) {
    const k = dateGroupKey(it.taken_at);
    const arr = groups.get(k);
    if (arr) arr.push(it);
    else groups.set(k, [it]);
  }
  const sections = Array.from(groups.entries()).map(([key, list]) => ({
    key,
    label: dateGroupLabel(key),
    items: list,
  }));

  const submit = async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(Array.from(selected));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-white">{title}</h3>
            <p className="text-xs text-gray-400">
              {selected.size > 0
                ? `${selected.size} selected`
                : "Tap photos to select them"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {visible.length === 0 && !loading ? (
            <div className="text-center text-gray-400 text-sm py-12">
              {excluded.size > 0
                ? "All your photos are already in this album."
                : "No photos yet. Upload some first."}
            </div>
          ) : (
            sections.map((section) => (
              <section key={section.key}>
                <h4 className="text-xs text-gray-400 font-medium mb-1.5">
                  {section.label}
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                  {section.items.map((it) => {
                    const isSelected = selected.has(it.id);
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => toggle(it.id)}
                        className={`relative aspect-square rounded overflow-hidden bg-gray-800 group ${
                          isSelected ? "ring-2 ring-violet-400" : ""
                        }`}
                      >
                        <img
                          src={thumbUrl(it)}
                          alt={it.filename}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        {it.kind === "video" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent">
                            <Play className="w-6 h-6 text-white drop-shadow" />
                          </div>
                        )}
                        <div className="absolute top-1 left-1 bg-black/60 rounded">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-violet-300" />
                          ) : (
                            <Square className="w-5 h-5 text-white/80 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
          <div ref={sentinelRef} className="h-8 flex items-center justify-center">
            {loading && <Loader2 className="w-5 h-5 animate-spin text-gray-500" />}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={selected.size === 0 || submitting}
            className="px-3 py-1.5 rounded-md text-sm bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 flex items-center gap-1"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel
              ? submitLabel(selected.size)
              : `Add ${selected.size || ""} ${
                  selected.size === 1 ? "photo" : "photos"
                }`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
