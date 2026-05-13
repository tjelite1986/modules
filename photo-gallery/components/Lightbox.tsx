"use client";

import { Component, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderPlus,
  Info,
  Keyboard,
  Pause,
  Play as PlayIcon,
  Plus,
  RotateCcw,
  RotateCw,
  Share2,
  Star,
  Tag,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { GalleryItem } from "./types";
import ShareTargetModal, { type ShareSource } from "@/components/ShareTargetModal";

interface Props {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onChangeIndex: (next: number) => void;
  onToggleFavorite: (item: GalleryItem) => void;
  onSoftDelete?: (item: GalleryItem) => void;
  onRestore?: (item: GalleryItem) => void;
  onHardDelete?: (item: GalleryItem) => void;
  fileUrl: (item: GalleryItem, variant: "preview" | "file") => string;
  allTags?: string[];
  authHeaders?: () => Record<string, string>;
  onAddToAlbum?: (item: GalleryItem) => void;
  onTagClick?: (tag: string) => void;
  onSetAsCover?: (item: GalleryItem) => void;
  isCover?: (item: GalleryItem) => boolean;
  onRotated?: (item: GalleryItem) => void;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(ms: number | null) {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-gray-400">{label}</dt>
      <dd
        className={`mt-0.5 break-all ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function Lightbox({
  items,
  index,
  onClose,
  onChangeIndex,
  onToggleFavorite,
  onSoftDelete,
  onRestore,
  onHardDelete,
  fileUrl,
  allTags,
  authHeaders,
  onAddToAlbum,
  onTagClick,
  onSetAsCover,
  isCover,
  onRotated,
}: Props) {
  const [rotating, setRotating] = useState(false);
  const [imgVersion, setImgVersion] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const [savingDate, setSavingDate] = useState(false);
  const item = items[index];
  const tagsEnabled = !!authHeaders;
  const [tags, setTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [exif, setExif] = useState<{
    make?: string;
    model?: string;
    lens?: string;
    iso?: number;
    aperture?: number;
    shutter?: string;
    focal_length?: number;
    flash?: string;
    software?: string;
    taken_at?: string;
    gps?: { lat: number; lng: number };
  } | null>(null);
  const [exifLoading, setExifLoading] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [ratingHover, setRatingHover] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const [shareSource, setShareSource] = useState<ShareSource | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const advance = useCallback(() => {
    if (index < items.length - 1) onChangeIndex(index + 1);
    else setPlaying(false);
  }, [index, items.length, onChangeIndex]);

  const saveDate = async () => {
    if (!item || !authHeaders || savingDate || !dateDraft) return;
    setSavingDate(true);
    try {
      const iso = new Date(dateDraft).toISOString();
      const res = await fetch(`/api/gallery/items/${item.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ taken_at: iso }),
      });
      if (res.ok) {
        const updated: GalleryItem = await res.json();
        if (onRotated) onRotated(updated);
        setEditingDate(false);
      }
    } finally {
      setSavingDate(false);
    }
  };

  const saveDescription = async () => {
    if (!item || !authHeaders || savingDesc) return;
    setSavingDesc(true);
    try {
      const res = await fetch(`/api/gallery/items/${item.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ description: descDraft.trim() || null }),
      });
      if (res.ok) {
        const updated: GalleryItem = await res.json();
        if (onRotated) onRotated(updated);
        setEditingDesc(false);
      }
    } finally {
      setSavingDesc(false);
    }
  };

  const setRating = async (next: number) => {
    if (!item || !authHeaders || savingRating) return;
    const target = item.rating === next ? 0 : next;
    setSavingRating(true);
    try {
      const res = await fetch(`/api/gallery/items/${item.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ rating: target }),
      });
      if (res.ok) {
        const updated: GalleryItem = await res.json();
        if (onRotated) onRotated(updated);
      }
    } finally {
      setSavingRating(false);
    }
  };

  const rotate = async (degrees: 90 | -90) => {
    if (!item || !authHeaders || rotating || item.kind !== "image") return;
    setRotating(true);
    try {
      const res = await fetch(`/api/gallery/items/${item.id}/rotate`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ degrees }),
      });
      if (res.ok) {
        const updated: GalleryItem = await res.json();
        setImgVersion((v) => v + 1);
        if (onRotated) onRotated(updated);
      }
    } finally {
      setRotating(false);
    }
  };

  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const lastTapRef = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [zoom, setZoom] = useState({ scale: 1, tx: 0, ty: 0 });
  const [smoothZoom, setSmoothZoom] = useState(false);

  useEffect(() => {
    setZoom({ scale: 1, tx: 0, ty: 0 });
    setDragOffset(null);
    setSmoothZoom(false);
    setEditingDesc(false);
    setEditingDate(false);
    setDescDraft(item?.description || "");
  }, [item?.id, item?.description]);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const marker = { __lightbox: true, t: Date.now() };
    window.history.pushState(marker, "");
    let closedNormally = false;
    const onPop = () => {
      closedNormally = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!closedNormally && typeof window !== "undefined") {
        const cur = window.history.state as { __lightbox?: boolean } | null;
        if (cur && cur.__lightbox) window.history.back();
      }
    };
  }, []);

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  const isZoomed = zoom.scale > 1.001;

  const touchDist = (a: React.Touch, b: React.Touch) =>
    Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        startDist: touchDist(e.touches[0], e.touches[1]),
        startScale: zoom.scale,
      };
      touchStartRef.current = null;
      panStartRef.current = null;
      setSmoothZoom(false);
      return;
    }
    if (e.touches.length !== 1) return;

    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      setSmoothZoom(true);
      if (isZoomed) setZoom({ scale: 1, tx: 0, ty: 0 });
      else setZoom({ scale: 2, tx: 0, ty: 0 });
      return;
    }
    lastTapRef.current = now;

    if (isZoomed) {
      panStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        startTx: zoom.tx,
        startTy: zoom.ty,
      };
      setSmoothZoom(false);
      return;
    }

    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: Date.now(),
    };
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const d = touchDist(e.touches[0], e.touches[1]);
      const next = Math.max(
        1,
        Math.min(6, pinchRef.current.startScale * (d / pinchRef.current.startDist)),
      );
      setZoom((z) => ({
        scale: next,
        tx: next === 1 ? 0 : z.tx,
        ty: next === 1 ? 0 : z.ty,
      }));
      return;
    }
    if (e.touches.length === 1 && panStartRef.current) {
      const dx = e.touches[0].clientX - panStartRef.current.x;
      const dy = e.touches[0].clientY - panStartRef.current.y;
      setZoom((z) => ({
        ...z,
        tx: panStartRef.current!.startTx + dx,
        ty: panStartRef.current!.startTy + dy,
      }));
      return;
    }
    if (isZoomed) return;
    const start = touchStartRef.current;
    if (!start || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (Math.abs(dx) > 8 || dy > 8) {
      setDragOffset({ x: dx, y: dy > 0 ? dy : 0 });
    }
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pinchRef.current) {
      pinchRef.current = null;
      return;
    }
    if (panStartRef.current) {
      panStartRef.current = null;
      return;
    }
    const start = touchStartRef.current;
    touchStartRef.current = null;
    setDragOffset(null);
    if (!start || isZoomed) return;
    const last = e.changedTouches[0];
    if (!last) return;
    const dx = last.clientX - start.x;
    const dy = last.clientY - start.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const HORIZ = 60;
    const VERT = 100;
    if (adx > HORIZ && adx > ady * 1.2) {
      if (dx < 0 && index < items.length - 1) onChangeIndex(index + 1);
      else if (dx > 0 && index > 0) onChangeIndex(index - 1);
    } else if (dy > VERT && dy > adx * 1.2) {
      onClose();
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (item?.kind !== "image") return;
    e.preventDefault();
    setSmoothZoom(false);
    setZoom((z) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = Math.max(1, Math.min(6, z.scale * factor));
      return {
        scale: next,
        tx: next === 1 ? 0 : z.tx,
        ty: next === 1 ? 0 : z.ty,
      };
    });
  };

  useEffect(() => {
    if (!playing) return;
    if (item?.kind === "video") return;
    const handle = setTimeout(advance, 4000);
    return () => clearTimeout(handle);
  }, [playing, item?.id, item?.kind, advance]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        if (showShortcuts) setShowShortcuts(false);
        else onClose();
      } else if (e.key === "ArrowLeft" && index > 0) onChangeIndex(index - 1);
      else if (e.key === "ArrowRight" && index < items.length - 1)
        onChangeIndex(index + 1);
      else if (e.key === "i" || e.key === "I") setShowInfo((v) => !v);
      else if (e.key === "?") setShowShortcuts((v) => !v);
      else if ((e.key === "f" || e.key === "F") && item && !item.is_deleted) {
        onToggleFavorite(item);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        item &&
        onSoftDelete &&
        !item.is_deleted
      ) {
        onSoftDelete(item);
      } else if (
        (e.key === "r" || e.key === "R") &&
        item &&
        item.kind === "image" &&
        authHeaders &&
        !item.is_deleted
      ) {
        rotate(e.shiftKey ? -90 : 90);
      } else if (e.key === " " && items.length > 1 && !item?.is_deleted) {
        e.preventDefault();
        setPlaying((v) => !v);
      } else if (
        /^[0-5]$/.test(e.key) &&
        item &&
        authHeaders &&
        !item.is_deleted
      ) {
        setRating(parseInt(e.key, 10));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length, onChangeIndex, onClose, showShortcuts, item?.id]);

  useEffect(() => {
    if (!tagsEnabled || !item) return;
    setTagDraft("");
    setShowTagInput(false);
    setTagError(null);
    let cancelled = false;
    setTagsLoading(true);
    fetch(`/api/gallery/items/${item.id}/tags`, { headers: authHeaders!() })
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((data) => {
        if (!cancelled) setTags(data.tags || []);
      })
      .finally(() => {
        if (!cancelled) setTagsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item?.id, tagsEnabled, authHeaders]);

  useEffect(() => {
    if (!showInfo || !item || !authHeaders || item.kind !== "image") {
      setExif(null);
      setLocationName(null);
      return;
    }
    let cancelled = false;
    setExifLoading(true);
    setExif(null);
    setLocationName(item.location_name);
    fetch(`/api/gallery/items/${item.id}/exif`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setExif(data || {});
        const lat = data?.gps?.lat ?? item.latitude;
        const lng = data?.gps?.lng ?? item.longitude;
        if (
          !cancelled &&
          typeof lat === "number" &&
          typeof lng === "number" &&
          !item.location_name
        ) {
          setLocationLoading(true);
          fetch(
            `/api/gallery/geocode?lat=${lat}&lng=${lng}&itemId=${item.id}`,
            { headers: authHeaders() },
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (!cancelled && d?.display_name) setLocationName(d.display_name);
            })
            .finally(() => {
              if (!cancelled) setLocationLoading(false);
            });
        }
      })
      .finally(() => {
        if (!cancelled) setExifLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showInfo, item?.id, item?.kind, item?.latitude, item?.longitude, item?.location_name, authHeaders]);

  const addTag = async () => {
    if (!item || !authHeaders) return;
    const value = tagDraft.trim();
    if (!value) return;
    setTagError(null);
    const res = await fetch(`/api/gallery/items/${item.id}/tags`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ tag: value }),
    });
    if (res.ok) {
      const data = await res.json();
      setTags(data.tags || []);
      setTagDraft("");
      setShowTagInput(false);
    } else {
      setTagError("Invalid tag (letters, digits, space, dash, underscore)");
    }
  };

  const removeTag = async (tag: string) => {
    if (!item || !authHeaders) return;
    const res = await fetch(
      `/api/gallery/items/${item.id}/tags/${encodeURIComponent(tag)}`,
      { method: "DELETE", headers: authHeaders() },
    );
    if (res.ok) {
      const data = await res.json();
      setTags(data.tags || []);
    }
  };

  const suggestions =
    showTagInput && tagDraft.trim() && allTags
      ? allTags
          .filter((t) => t.startsWith(tagDraft.trim().toLowerCase()) && !tags.includes(t))
          .slice(0, 6)
      : [];

  if (!item) return null;

  const isFav = item.is_favorite === 1;
  const isTrashed = item.is_deleted === 1;
  const taken = new Date(item.taken_at);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-black/40 text-white text-sm overflow-x-auto"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="truncate">
            <div className="font-medium truncate">{item.filename}</div>
            <div className="text-xs text-gray-400 truncate">
              {taken.toLocaleString()} · {formatBytes(item.size_bytes)}
              {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
              {item.duration_ms ? ` · ${formatDuration(item.duration_ms)}` : ""}
            </div>
            {!isTrashed && authHeaders && (
              <div
                className="flex items-center gap-0.5 mt-0.5"
                onMouseLeave={() => setRatingHover(0)}
              >
                {[1, 2, 3, 4, 5].map((n) => {
                  const lit = (ratingHover || item.rating) >= n;
                  return (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setRatingHover(n)}
                      disabled={savingRating}
                      className="p-0.5 hover:scale-110 transition-transform disabled:opacity-50"
                      aria-label={`Rate ${n} stars`}
                      title={
                        item.rating === n
                          ? `Clear rating (currently ${n})`
                          : `Rate ${n} ${n === 1 ? "star" : "stars"}`
                      }
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          lit ? "fill-yellow-400 text-yellow-400" : "text-gray-600"
                        }`}
                      />
                    </button>
                  );
                })}
                {item.rating > 0 && (
                  <button
                    onClick={() => setRating(0)}
                    disabled={savingRating}
                    className="ml-1 text-[10px] text-gray-500 hover:text-gray-200"
                    title="Clear rating"
                  >
                    clear
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isTrashed && items.length > 1 && (
            <button
              onClick={() => setPlaying((v) => !v)}
              className={`p-1.5 rounded hover:bg-white/10 ${playing ? "text-violet-300" : ""}`}
              aria-label={playing ? "Pause slideshow" : "Play slideshow"}
              title={playing ? "Pause slideshow" : "Play slideshow"}
            >
              {playing ? (
                <Pause className="w-5 h-5" />
              ) : (
                <PlayIcon className="w-5 h-5" />
              )}
            </button>
          )}
          {!isTrashed && (
            <button
              onClick={() => onToggleFavorite(item)}
              className="p-1.5 rounded hover:bg-white/10"
              aria-label={isFav ? "Unfavorite" : "Favorite"}
              title={isFav ? "Unfavorite" : "Favorite"}
            >
              <Star
                className={`w-5 h-5 ${isFav ? "fill-yellow-400 text-yellow-400" : ""}`}
              />
            </button>
          )}
          {!isTrashed && onAddToAlbum && (
            <button
              onClick={() => onAddToAlbum(item)}
              className="p-1.5 rounded hover:bg-white/10"
              aria-label="Add to album"
              title="Add to album"
            >
              <FolderPlus className="w-5 h-5" />
            </button>
          )}
          {!isTrashed && item.kind === "image" && authHeaders && (
            <>
              <button
                onClick={() => rotate(-90)}
                disabled={rotating}
                className="p-1.5 rounded hover:bg-white/10 disabled:opacity-50"
                aria-label="Rotate left"
                title="Rotate left 90°"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={() => rotate(90)}
                disabled={rotating}
                className="p-1.5 rounded hover:bg-white/10 disabled:opacity-50"
                aria-label="Rotate right"
                title="Rotate right 90°"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </>
          )}
          {!isTrashed && onSetAsCover && (
            <button
              onClick={() => onSetAsCover(item)}
              disabled={isCover ? isCover(item) : false}
              className={`p-1.5 rounded hover:bg-white/10 ${
                isCover && isCover(item) ? "text-violet-300" : ""
              } disabled:opacity-60 disabled:cursor-default`}
              aria-label={isCover && isCover(item) ? "Album cover" : "Set as album cover"}
              title={isCover && isCover(item) ? "Album cover" : "Set as album cover"}
            >
              <Bookmark
                className={`w-5 h-5 ${
                  isCover && isCover(item) ? "fill-violet-400 text-violet-400" : ""
                }`}
              />
            </button>
          )}
          <a
            href={fileUrl(item, "file")}
            download={item.filename}
            className="p-1.5 rounded hover:bg-white/10"
            aria-label="Download"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            type="button"
            onClick={() => setShareSource({
              kind: "gallery",
              galleryItemId: item.id,
              mediaType: item.mime_type,
              mediaName: item.filename,
              previewUrl: fileUrl(item, "preview"),
            })}
            className="p-1.5 rounded hover:bg-white/10"
            aria-label="Share"
            title="Share"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className={`p-1.5 rounded hover:bg-white/10 ${showInfo ? "text-violet-300" : ""}`}
            aria-label="Info"
            title="Info (i)"
          >
            <Info className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowShortcuts((v) => !v)}
            className="p-1.5 rounded hover:bg-white/10 hidden sm:inline-flex"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-5 h-5" />
          </button>
          {isTrashed ? (
            <>
              {onRestore && (
                <button
                  onClick={() => onRestore(item)}
                  className="p-1.5 rounded hover:bg-white/10"
                  aria-label="Restore"
                  title="Restore"
                >
                  <Undo2 className="w-5 h-5" />
                </button>
              )}
              {onHardDelete && (
                <button
                  onClick={() => {
                    if (confirm("Permanently delete this item?")) onHardDelete(item);
                  }}
                  className="p-1.5 rounded hover:bg-red-500/20 text-red-300"
                  aria-label="Delete forever"
                  title="Delete forever"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </>
          ) : (
            onSoftDelete && (
              <button
                onClick={() => onSoftDelete(item)}
                className="p-1.5 rounded hover:bg-white/10"
                aria-label="Move to trash"
                title="Move to trash"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )
          )}
        </div>
      </div>

      {tagsEnabled && !isTrashed && (
        <div className="flex-shrink-0 px-4 py-2 bg-black/30 border-t border-white/5 flex flex-wrap items-center gap-1.5 text-xs max-h-32 overflow-y-auto">
          <Tag className="w-3.5 h-3.5 text-gray-400 mr-0.5" />
          {tagsLoading ? (
            <span className="text-gray-500">Loading tags…</span>
          ) : (
            <>
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-0.5 bg-violet-500/20 border border-violet-500/40 text-violet-200 rounded-full pl-0.5 pr-1 py-0.5"
                >
                  {onTagClick ? (
                    <button
                      onClick={() => onTagClick(t)}
                      className="px-1.5 py-0 hover:text-white"
                      title={`Filter by ${t}`}
                    >
                      {t}
                    </button>
                  ) : (
                    <span className="px-1.5">{t}</span>
                  )}
                  <button
                    onClick={() => removeTag(t)}
                    className="hover:bg-white/10 rounded-full p-0.5"
                    aria-label={`Remove tag ${t}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {showTagInput ? (
                <span className="relative inline-flex items-center gap-1">
                  <input
                    ref={inputRef}
                    type="text"
                    autoFocus
                    value={tagDraft}
                    onChange={(e) => {
                      setTagDraft(e.target.value);
                      setTagError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      } else if (e.key === "Escape") {
                        setShowTagInput(false);
                        setTagDraft("");
                        setTagError(null);
                      }
                    }}
                    placeholder="new tag…"
                    className="bg-gray-800 border border-gray-600 rounded-full px-2 py-0.5 text-xs text-white w-32 focus:outline-none focus:border-violet-400"
                  />
                  <button
                    onClick={addTag}
                    className="px-2 py-0.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowTagInput(false);
                      setTagDraft("");
                      setTagError(null);
                    }}
                    className="text-gray-400 hover:text-white"
                    aria-label="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {suggestions.length > 0 && (
                    <ul className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-10 min-w-[8rem] max-h-40 overflow-auto">
                      {suggestions.map((s) => (
                        <li key={s}>
                          <button
                            onClick={() => {
                              setTagDraft(s);
                              setTimeout(() => addTag(), 0);
                            }}
                            className="block w-full text-left px-2 py-1 text-xs text-gray-200 hover:bg-gray-800"
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </span>
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-600 hover:border-gray-400 text-gray-300"
                >
                  <Plus className="w-3 h-3" /> Add tag
                </button>
              )}
              {tagError && <span className="text-red-300 ml-2">{tagError}</span>}
            </>
          )}
        </div>
      )}

      <div className="relative flex-1 min-h-0 flex items-center justify-center select-none overflow-hidden">
        {showInfo && (
          <aside className="absolute top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-gray-950/95 border-l border-gray-800 overflow-y-auto p-4 text-sm text-gray-200 z-20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white">Info</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close info"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <InfoErrorBoundary>
            {!isTrashed && authHeaders && (
              <div className="mb-4 pb-4 border-b border-gray-800">
                <div className="text-xs text-gray-400 mb-1">Description</div>
                {editingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setEditingDesc(false);
                          setDescDraft(item.description || "");
                        }
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          saveDescription();
                        }
                      }}
                      placeholder="Add a description…"
                      rows={3}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-400 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingDesc(false);
                          setDescDraft(item.description || "");
                        }}
                        className="px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveDescription}
                        disabled={savingDesc}
                        className="px-2 py-1 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : item.description ? (
                  <button
                    onClick={() => {
                      setDescDraft(item.description || "");
                      setEditingDesc(true);
                    }}
                    className="text-left text-sm text-gray-200 hover:text-white whitespace-pre-wrap w-full block hover:bg-gray-900 rounded px-2 py-1 -mx-2"
                    title="Edit description"
                  >
                    {item.description}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setDescDraft("");
                      setEditingDesc(true);
                    }}
                    className="text-left text-xs text-gray-500 hover:text-gray-300 italic"
                  >
                    + Add description
                  </button>
                )}
              </div>
            )}
            <dl className="space-y-2 text-xs">
              <InfoRow label="Filename" value={item.filename} mono />
              <InfoRow label="Type" value={item.mime_type} mono />
              <div>
                <dt className="text-gray-400">Taken</dt>
                <dd className="mt-0.5">
                  {editingDate && !isTrashed && authHeaders ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <input
                        type="datetime-local"
                        value={dateDraft}
                        autoFocus
                        onChange={(e) => setDateDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveDate();
                          if (e.key === "Escape") setEditingDate(false);
                        }}
                        className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-violet-400"
                      />
                      <button
                        onClick={saveDate}
                        disabled={savingDate || !dateDraft}
                        className="px-2 py-0.5 text-[11px] bg-violet-600 hover:bg-violet-500 text-white rounded disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingDate(false)}
                        className="px-2 py-0.5 text-[11px] text-gray-300 hover:bg-gray-800 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (isTrashed || !authHeaders) return;
                        const pad = (n: number) => String(n).padStart(2, "0");
                        const local = `${taken.getFullYear()}-${pad(taken.getMonth() + 1)}-${pad(taken.getDate())}T${pad(taken.getHours())}:${pad(taken.getMinutes())}`;
                        setDateDraft(local);
                        setEditingDate(true);
                      }}
                      className={`text-left ${
                        !isTrashed && authHeaders
                          ? "hover:bg-gray-900 hover:text-white -mx-1 px-1 rounded"
                          : ""
                      }`}
                      title={!isTrashed && authHeaders ? "Click to edit" : undefined}
                    >
                      {taken.toLocaleString(undefined, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </button>
                  )}
                </dd>
              </div>
              <InfoRow
                label="Uploaded"
                value={new Date(item.uploaded_at).toLocaleString()}
              />
              <InfoRow label="Size" value={formatBytes(item.size_bytes)} />
              {item.width && item.height && (
                <InfoRow
                  label="Dimensions"
                  value={`${item.width} × ${item.height} px`}
                />
              )}
              {item.duration_ms ? (
                <InfoRow
                  label="Duration"
                  value={formatDuration(item.duration_ms) || ""}
                />
              ) : null}
              <InfoRow label="Storage" value={item.storage_key} mono />
              {item.kind === "image" && (
                <div className="pt-2 border-t border-gray-800">
                  <div className="text-gray-400 mb-1.5">Camera</div>
                  {exifLoading ? (
                    <div className="text-gray-500">Reading EXIF…</div>
                  ) : exif && Object.keys(exif).length > 0 ? (
                    <div className="space-y-2">
                      {(exif.make || exif.model) && (
                        <InfoRow
                          label="Camera"
                          value={[exif.make, exif.model].filter(Boolean).join(" ")}
                        />
                      )}
                      {exif.lens && <InfoRow label="Lens" value={exif.lens} />}
                      {(exif.aperture ||
                        exif.shutter ||
                        exif.iso ||
                        exif.focal_length) && (
                        <InfoRow
                          label="Exposure"
                          value={[
                            exif.aperture ? `f/${exif.aperture}` : null,
                            exif.shutter,
                            exif.iso ? `ISO ${exif.iso}` : null,
                            exif.focal_length ? `${exif.focal_length}mm` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        />
                      )}
                      {exif.flash && <InfoRow label="Flash" value={exif.flash} />}
                      {exif.software && (
                        <InfoRow label="Software" value={exif.software} />
                      )}
                      {exif.gps &&
                        Number.isFinite(exif.gps.lat) &&
                        Number.isFinite(exif.gps.lng) && (
                          <GpsBlock
                            lat={exif.gps.lat}
                            lng={exif.gps.lng}
                            locationName={locationName}
                            locationLoading={locationLoading}
                          />
                        )}
                    </div>
                  ) : (
                    <div className="text-gray-500">No EXIF data.</div>
                  )}
                </div>
              )}
              {tags.length > 0 && (
                <div>
                  <dt className="text-gray-400">Tags</dt>
                  <dd className="mt-0.5 flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="bg-violet-500/20 border border-violet-500/40 text-violet-200 rounded-full px-2 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            </InfoErrorBoundary>
          </aside>
        )}
        {index > 0 && (
          <button
            onClick={() => onChangeIndex(index - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/60 text-white"
            aria-label="Previous"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        )}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            touchAction: "none",
            transform: dragOffset
              ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`
              : `translate3d(${zoom.tx}px, ${zoom.ty}px, 0) scale(${zoom.scale})`,
            opacity: dragOffset
              ? Math.max(
                  0.4,
                  1 - Math.max(Math.abs(dragOffset.x), dragOffset.y) / 400,
                )
              : 1,
            transition:
              dragOffset || (isZoomed && !smoothZoom) || panStartRef.current || pinchRef.current
                ? "none"
                : smoothZoom
                  ? "transform 0.2s ease"
                  : "transform 0.18s ease, opacity 0.18s ease",
            willChange: "transform, opacity",
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => {
            touchStartRef.current = null;
            pinchRef.current = null;
            panStartRef.current = null;
            setDragOffset(null);
          }}
          onWheel={onWheel}
          onDoubleClick={() => {
            setSmoothZoom(true);
            setZoom((z) =>
              z.scale > 1.001 ? { scale: 1, tx: 0, ty: 0 } : { scale: 2, tx: 0, ty: 0 },
            );
          }}
        >
          {item.kind === "video" ? (
            <video
              key={item.id}
              src={fileUrl(item, "file")}
              controls
              autoPlay
              playsInline
              onEnded={() => {
                if (playing) advance();
              }}
              className="max-h-full max-w-full"
            />
          ) : (
            <img
              key={`${item.id}-${imgVersion}`}
              src={
                imgVersion > 0
                  ? `${fileUrl(item, "preview")}${
                      fileUrl(item, "preview").includes("?") ? "&" : "?"
                    }v=${imgVersion}`
                  : fileUrl(item, "preview")
              }
              alt={item.filename}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          )}
        </div>
        {isZoomed && (
          <button
            onClick={() => {
              setSmoothZoom(true);
              setZoom({ scale: 1, tx: 0, ty: 0 });
            }}
            className="absolute bottom-4 right-4 z-30 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs flex items-center gap-1"
          >
            Reset zoom ({zoom.scale.toFixed(1)}×)
          </button>
        )}
        {index < items.length - 1 && (
          <button
            onClick={() => onChangeIndex(index + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/60 text-white"
            aria-label="Next"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        )}
      </div>

      {showShortcuts && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-lg p-5 max-w-md w-full text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5" /> Keyboard shortcuts
              </h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <table className="w-full text-gray-300">
              <tbody>
                <ShortcutRow keys={["←", "→"]} desc="Previous / next image" />
                <ShortcutRow keys={["Space"]} desc="Play / pause slideshow" />
                <ShortcutRow keys={["f"]} desc="Toggle favorite" />
                <ShortcutRow keys={["r"]} desc="Rotate right 90°" />
                <ShortcutRow keys={["Shift", "+", "R"]} desc="Rotate left 90°" />
                <ShortcutRow keys={["Del"]} desc="Move to trash" />
                <ShortcutRow keys={["i"]} desc="Toggle info panel" />
                <ShortcutRow keys={["Esc"]} desc="Close lightbox" />
                <ShortcutRow keys={["?"]} desc="Show this help" />
                <ShortcutRow keys={["Double-click"]} desc="Zoom 2× / reset" />
                <ShortcutRow keys={["Scroll"]} desc="Zoom in / out" />
              </tbody>
            </table>
            <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-400 space-y-1">
              <div>
                <span className="text-gray-200">On mobile:</span> swipe left/right
                to navigate, swipe down to close, pinch to zoom, double-tap to
                toggle 2×.
              </div>
              <div>
                <span className="text-gray-200">In grid:</span> long-press to enter
                multi-select mode.
              </div>
            </div>
          </div>
        </div>
      )}
      <ShareTargetModal
        open={shareSource !== null}
        source={shareSource}
        onClose={() => setShareSource(null)}
      />
    </div>
  );
}

class InfoErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("Info panel error:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="text-xs text-red-300 p-3 border border-red-600/40 bg-red-600/10 rounded">
          Couldn&apos;t render details: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

function buildOsmEmbedSrc(lat: number, lng: number): string {
  const minLng = (lng - 0.01).toFixed(6);
  const minLat = (lat - 0.005).toFixed(6);
  const maxLng = (lng + 0.01).toFixed(6);
  const maxLat = (lat + 0.005).toFixed(6);
  const markerLat = lat.toFixed(6);
  const markerLng = lng.toFixed(6);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik&marker=${markerLat},${markerLng}`;
}

function GpsBlock({
  lat,
  lng,
  locationName,
  locationLoading,
}: {
  lat: number;
  lng: number;
  locationName: string | null;
  locationLoading: boolean;
}) {
  let embedSrc = "";
  try {
    embedSrc = buildOsmEmbedSrc(lat, lng);
  } catch {
    embedSrc = "";
  }
  return (
    <div>
      <dt className="text-gray-400">Location</dt>
      <dd className="mt-0.5 space-y-1.5">
        {locationName ? (
          <div className="text-gray-200 leading-snug">{locationName}</div>
        ) : locationLoading ? (
          <div className="text-gray-500 text-[11px]">Looking up place name…</div>
        ) : null}
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-300 hover:text-violet-200 underline text-[11px]"
        >
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </a>
        {embedSrc && (
          <iframe
            title="Location map"
            loading="lazy"
            src={embedSrc}
            className="w-full h-40 rounded border border-gray-700 bg-gray-800"
          />
        )}
      </dd>
    </div>
  );
}

function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <tr>
      <td className="py-1 pr-3 align-top">
        <div className="flex flex-wrap gap-1">
          {keys.map((k) => (
            <kbd
              key={k}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-white whitespace-nowrap"
            >
              {k}
            </kbd>
          ))}
        </div>
      </td>
      <td className="py-1 text-gray-300">{desc}</td>
    </tr>
  );
}
