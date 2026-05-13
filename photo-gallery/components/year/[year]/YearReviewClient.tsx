"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Camera,
  Clock,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plane,
  Star,
  Tag,
  Video as VideoIcon,
} from "lucide-react";
import { thumbUrl } from "../../GalleryClient";
import type { GalleryItem, MediaKind } from "../../types";

interface YearReview {
  year: number;
  total_items: number;
  total_size_bytes: number;
  image_count: number;
  video_count: number;
  favorite_count: number;
  total_video_ms: number;
  monthly: { month: number; count: number }[];
  top_tags: { tag: string; count: number }[];
  top_places: { name: string; count: number }[];
  top_rated: GalleryItem[];
  top_favorites: GalleryItem[];
  first_item: GalleryItem | null;
  last_item: GalleryItem | null;
  trip_count: number;
  cover_storage_key: string | null;
  cover_kind: MediaKind | null;
}

function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") ?? "";
}

function authHeaders() {
  return { Authorization: `Bearer ${authToken()}` };
}

function formatBytes(n: number) {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  return `${(n / 1024 ** 4).toFixed(2)} TB`;
}

function formatHours(ms: number) {
  if (!ms) return "0";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "violet",
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  accent?: "violet" | "yellow" | "sky" | "emerald" | "rose";
}) {
  const ring: Record<string, string> = {
    violet: "border-violet-500/40 text-violet-200",
    yellow: "border-yellow-500/40 text-yellow-200",
    sky: "border-sky-500/40 text-sky-200",
    emerald: "border-emerald-500/40 text-emerald-200",
    rose: "border-rose-500/40 text-rose-200",
  };
  return (
    <div
      className={`bg-gray-900/70 border ${ring[accent]} rounded-lg p-4 flex flex-col gap-1`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-70">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-gray-400">{hint}</div>}
    </div>
  );
}

export default function YearReviewClient({ year }: { year: number }) {
  const [data, setData] = useState<YearReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/gallery/year/${year}`, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load year review");
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Building {year} review…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-red-300 text-sm">
        {error}
      </div>
    );
  }

  if (!data || data.total_items === 0) {
    return (
      <div className="space-y-4">
        <Link
          href="/gallery"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to gallery
        </Link>
        <div className="rounded-md border border-gray-800 p-10 text-center text-gray-400">
          Nothing photographed in {year} yet.
        </div>
      </div>
    );
  }

  const maxMonth = Math.max(...data.monthly.map((m) => m.count), 1);
  const cover = data.cover_storage_key
    ? `/api/gallery/preview/${data.cover_storage_key}?t=${encodeURIComponent(authToken())}`
    : null;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link
          href="/gallery"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Gallery
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={`/gallery/year/${year - 1}`}
            className="px-2 py-1 rounded border border-gray-700 hover:border-gray-500 text-gray-300"
          >
            ← {year - 1}
          </Link>
          {year < new Date().getFullYear() && (
            <Link
              href={`/gallery/year/${year + 1}`}
              className="px-2 py-1 rounded border border-gray-700 hover:border-gray-500 text-gray-300"
            >
              {year + 1} →
            </Link>
          )}
        </div>
      </div>

      <div
        className="relative rounded-xl overflow-hidden border border-gray-800 h-64 md:h-80 flex items-end"
        style={{
          backgroundImage: cover ? `url(${cover})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="relative p-6 md:p-8">
          <div className="text-xs uppercase tracking-widest text-violet-300">
            Year in review
          </div>
          <div className="text-5xl md:text-7xl font-bold text-white mt-1">{year}</div>
          <div className="text-gray-200 text-sm md:text-base mt-2">
            {data.total_items.toLocaleString()} photos & videos · {formatBytes(data.total_size_bytes)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={ImageIcon}
          label="Photos"
          value={data.image_count.toLocaleString()}
          accent="violet"
        />
        <StatCard
          icon={VideoIcon}
          label="Videos"
          value={data.video_count.toLocaleString()}
          hint={`${formatHours(data.total_video_ms)} of footage`}
          accent="sky"
        />
        <StatCard
          icon={Star}
          label="Favorites"
          value={data.favorite_count.toLocaleString()}
          accent="yellow"
        />
        <StatCard
          icon={Plane}
          label="Trips"
          value={data.trip_count.toLocaleString()}
          accent="emerald"
        />
      </div>

      <section>
        <h2 className="text-sm text-gray-300 mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Activity by month
        </h2>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-12 gap-1.5 items-end h-32">
            {data.monthly.map((m) => {
              const heightPct = (m.count / maxMonth) * 100;
              return (
                <div
                  key={m.month}
                  className="flex flex-col items-center justify-end h-full"
                >
                  <div className="text-[10px] text-gray-500 mb-0.5">{m.count || ""}</div>
                  <div
                    className="w-full bg-gradient-to-t from-violet-700 to-violet-400 rounded-t-sm transition-all min-h-[2px]"
                    style={{ height: `${heightPct}%` }}
                    title={`${MONTH_LABELS[m.month - 1]}: ${m.count}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-12 gap-1.5 mt-1.5 text-[10px] text-gray-400 text-center">
            {MONTH_LABELS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
        </div>
      </section>

      {data.top_places.length > 0 && (
        <section>
          <h2 className="text-sm text-gray-300 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Top places
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.top_places.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 rounded-full px-3 py-1 text-sm"
                title={p.name}
              >
                <span className="truncate max-w-[18rem]">{p.name}</span>
                <span className="text-emerald-300/70 text-xs">· {p.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {data.top_tags.length > 0 && (
        <section>
          <h2 className="text-sm text-gray-300 mb-2 flex items-center gap-2">
            <Tag className="w-4 h-4" /> Top tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.top_tags.map((t) => (
              <Link
                key={t.tag}
                href={`/gallery?tag=${encodeURIComponent(t.tag)}`}
                className="inline-flex items-center gap-1 bg-violet-500/10 border border-violet-500/30 text-violet-200 rounded-full px-3 py-1 text-sm hover:bg-violet-500/20"
              >
                {t.tag}
                <span className="text-violet-300/70 text-xs">· {t.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.top_rated.length > 0 && (
        <section>
          <h2 className="text-sm text-gray-300 mb-2 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Top rated
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {data.top_rated.map((it) => (
              <Link
                key={it.id}
                href={`/gallery?open=${it.id}`}
                className="relative aspect-square rounded overflow-hidden bg-gray-900 group"
              >
                <img
                  src={thumbUrl(it)}
                  alt={it.filename}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute bottom-1 left-1 bg-black/60 text-yellow-300 rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  {it.rating}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.top_favorites.length > 0 && (
        <section>
          <h2 className="text-sm text-gray-300 mb-2 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Favorites
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {data.top_favorites.map((it) => (
              <Link
                key={it.id}
                href={`/gallery?open=${it.id}`}
                className="relative aspect-square rounded overflow-hidden bg-gray-900 group"
              >
                <img
                  src={thumbUrl(it)}
                  alt={it.filename}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {(data.first_item || data.last_item) && (
        <section>
          <h2 className="text-sm text-gray-300 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Bookends
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {data.first_item && (
              <Link
                href={`/gallery?open=${data.first_item.id}`}
                className="relative aspect-video rounded overflow-hidden bg-gray-900 group block"
              >
                <img
                  src={thumbUrl(data.first_item)}
                  alt="First"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 text-xs">
                  <div className="text-gray-300">First of {year}</div>
                  <div className="text-white font-medium">
                    {new Date(data.first_item.taken_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            )}
            {data.last_item && data.last_item.id !== data.first_item?.id && (
              <Link
                href={`/gallery?open=${data.last_item.id}`}
                className="relative aspect-video rounded overflow-hidden bg-gray-900 group block"
              >
                <img
                  src={thumbUrl(data.last_item)}
                  alt="Last"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 text-xs">
                  <div className="text-gray-300">Most recent in {year}</div>
                  <div className="text-white font-medium">
                    {new Date(data.last_item.taken_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      <div className="text-center pt-4">
        <Link
          href={`/gallery?year=${year}`}
          className="inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200"
        >
          <Camera className="w-4 h-4" /> See everything from {year}
        </Link>
      </div>
    </div>
  );
}
