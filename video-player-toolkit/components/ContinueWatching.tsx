"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readResumePositions } from "../hooks/useVideoResume";

export type WatchableItem = {
  id: number | string;
  title: string;
  duration?: number | null;
  thumbnailUrl?: string | null;
};

type Entry = { item: WatchableItem; seconds: number };

interface Props {
  /** Endpoint that returns `{ items: WatchableItem[] }` for `?ids=1,2,3`. */
  fetchItems: (ids: (string | number)[]) => Promise<WatchableItem[]>;
  /** Build the watch URL for an item — e.g. `(item) => "/watch/" + item.id`. */
  watchHref: (item: WatchableItem) => string;
  /** Optional placeholder thumbnail when an item has none. */
  placeholderThumb?: string;
  /** Heading text. */
  title?: string;
  /** Skip resume keys that don't pass this filter (e.g. exclude YouTube-only entries). */
  filterKey?: (key: string) => boolean;
}

function formatDuration(secs?: number | null): string {
  if (!secs) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * "Continue watching" carousel. Reads resume positions saved by useVideoResume
 * from localStorage, fetches matching item metadata from your API, and renders
 * a horizontally-scrolling row with a red progress bar.
 *
 * Items are excluded if they're already 95%+ complete.
 */
export default function ContinueWatching({
  fetchItems,
  watchHref,
  placeholderThumb = "/placeholder-thumb.svg",
  title = "Continue watching",
  filterKey,
}: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const positions = readResumePositions().filter(
      (p) => !filterKey || filterKey(p.key),
    );
    if (positions.length === 0) return;

    fetchItems(positions.map((p) => p.key))
      .then((items) => {
        const result: Entry[] = items
          .map((item) => {
            const pos = positions.find((p) => String(p.key) === String(item.id));
            if (!pos) return null;
            if (item.duration && pos.seconds >= item.duration * 0.95) return null;
            return { item, seconds: pos.seconds };
          })
          .filter((x): x is Entry => x !== null);
        setEntries(result);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className="px-3 sm:px-6 pt-4">
      <h2 className="text-sm font-semibold text-white mb-3">{title}</h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {entries.map(({ item, seconds }) => {
          const progress = item.duration ? Math.min((seconds / item.duration) * 100, 99) : 0;
          const thumb = item.thumbnailUrl || placeholderThumb;
          return (
            <Link key={item.id} href={watchHref(item)} className="shrink-0 w-44 group">
              <div className="relative w-full aspect-video bg-zinc-800 rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                />
                {item.duration && (
                  <span className="absolute bottom-5 right-1 bg-black/80 text-white text-xs px-1 rounded">
                    {formatDuration(item.duration)}
                  </span>
                )}
                {progress > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                    <div className="h-full bg-red-500" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
              <p className="text-xs text-white mt-1.5 line-clamp-2 leading-snug group-hover:text-white transition-colors">
                {item.title}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
