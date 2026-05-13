"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  X,
} from "lucide-react";
import type { GalleryItem } from "../../types";

interface SharedView {
  album: {
    id: number;
    user_id: number;
    name: string;
    description: string | null;
    cover_item_id: number | null;
    created_at: string;
    updated_at: string;
    owner_username: string;
  };
  items: GalleryItem[];
}

function sharedFileUrl(token: string, item: GalleryItem, variant: "thumb" | "preview" | "file") {
  return `/api/gallery/shared/${token}/file/${item.storage_key}?v=${variant}`;
}

export default function SharedAlbumClient({ token }: { token: string }) {
  const [view, setView] = useState<SharedView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/gallery/shared/${token}`, { cache: "no-store" });
      if (res.ok) {
        setView(await res.json());
      } else {
        setError("This link is invalid or has expired.");
      }
      setLoading(false);
    })();
  }, [token]);

  useEffect(() => {
    if (index === null) return;
    function onKey(e: KeyboardEvent) {
      if (!view) return;
      if (e.key === "Escape") setIndex(null);
      else if (e.key === "ArrowLeft" && index !== null && index > 0) setIndex(index - 1);
      else if (
        e.key === "ArrowRight" &&
        index !== null &&
        index < view.items.length - 1
      )
        setIndex(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, view]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (error || !view) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center text-sm">
        {error || "Not found."}
      </div>
    );
  }

  const current = index !== null ? view.items[index] : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-semibold">{view.album.name}</h1>
        <p className="text-sm text-gray-400">
          Shared by {view.album.owner_username} · {view.items.length} items
        </p>
        {view.album.description && (
          <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">
            {view.album.description}
          </p>
        )}
      </header>
      <main className="max-w-7xl mx-auto p-4">
        {view.items.length === 0 ? (
          <div className="text-gray-400 text-sm">This album is empty.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
            {view.items.map((it, i) => (
              <button
                key={it.id}
                onClick={() => setIndex(i)}
                className="relative aspect-square rounded overflow-hidden bg-gray-900 group"
              >
                <img
                  src={sharedFileUrl(token, it, "thumb")}
                  alt={it.filename}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                {it.kind === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent">
                    <Play className="w-7 h-7 text-white drop-shadow" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {current && index !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-black/40">
            <button
              onClick={() => setIndex(null)}
              className="p-1.5 rounded hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-sm text-gray-300 truncate">{current.filename}</div>
            <div className="w-8" />
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center relative">
            {index > 0 && (
              <button
                onClick={() => setIndex(index - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/60"
              >
                <ChevronLeft className="w-7 h-7" />
              </button>
            )}
            {current.kind === "video" ? (
              <video
                key={current.id}
                src={sharedFileUrl(token, current, "file")}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full"
              />
            ) : (
              <img
                key={current.id}
                src={sharedFileUrl(token, current, "preview")}
                alt={current.filename}
                className="max-h-full max-w-full object-contain"
              />
            )}
            {index < view.items.length - 1 && (
              <button
                onClick={() => setIndex(index + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/60"
              >
                <ChevronRight className="w-7 h-7" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
