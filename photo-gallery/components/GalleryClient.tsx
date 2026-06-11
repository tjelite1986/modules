"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Album,
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  CheckSquare,
  Clock,
  CloudUpload,
  Download,
  Filter,
  FolderPlus,
  Grid2x2,
  Grid3x3,
  History,
  LayoutGrid,
  Loader2,
  MapPin,
  Plane,
  Play,
  PlusCircle,
  Save,
  Search,
  Share2,
  Sparkles,
  Square,
  Star,
  Tag,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import UploadDropzone from "./UploadDropzone";
import Lightbox from "./Lightbox";
import ShareTargetModal, { type ShareSource } from "@/components/ShareTargetModal";
import { mediaToken } from "@/lib/mediaToken";
import type {
  AlbumWithCounts,
  GalleryItem,
  GalleryStats,
  GalleryTab,
  ListResult,
  MemoryGroup,
} from "./types";

function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") ?? "";
}

function authHeaders() {
  return { Authorization: `Bearer ${authToken()}` };
}

export function thumbUrl(item: GalleryItem) {
  return `/api/gallery/thumb/${item.storage_key}?t=${encodeURIComponent(mediaToken())}`;
}

export function previewUrl(item: GalleryItem) {
  return `/api/gallery/preview/${item.storage_key}?t=${encodeURIComponent(mediaToken())}`;
}

export function originalUrl(item: GalleryItem) {
  return `/api/gallery/file/${item.storage_key}?t=${encodeURIComponent(mediaToken())}`;
}

function fileUrlForLightbox(item: GalleryItem, variant: "preview" | "file") {
  return variant === "preview" ? previewUrl(item) : originalUrl(item);
}

function formatBytes(n: number) {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  return `${(n / 1024 ** 4).toFixed(2)} TB`;
}

function dateGroupKey(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function dateGroupLabel(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  const today = new Date();
  const yKey = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    .toISOString()
    .slice(0, 10);
  if (key === yKey) return "Today";
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (key === yest.toISOString().slice(0, 10)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type TopTab = GalleryTab | "albums";

const TAB_DEFS: { key: TopTab; label: string; icon: any }[] = [
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "albums", label: "Albums", icon: Album },
  { key: "favorites", label: "Favorites", icon: Star },
  { key: "trash", label: "Trash", icon: Trash2 },
];

export default function GalleryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tagFilter = searchParams.get("tag") || "";
  const yearFilterRaw = searchParams.get("year");
  const yearFilter = yearFilterRaw ? parseInt(yearFilterRaw, 10) : null;
  const fromFilter = searchParams.get("from") || "";
  const toFilter = searchParams.get("to") || "";
  const minRatingRaw = searchParams.get("minRating");
  const minRatingFilter =
    minRatingRaw && /^[1-5]$/.test(minRatingRaw) ? parseInt(minRatingRaw, 10) : 0;
  const smartAlbumIdRaw = searchParams.get("smart");
  const smartAlbumId = smartAlbumIdRaw ? parseInt(smartAlbumIdRaw, 10) : 0;
  const tabParam = searchParams.get("tab");
  const tab: TopTab =
    tabParam === "albums" ||
    tabParam === "favorites" ||
    tabParam === "trash" ||
    tabParam === "timeline"
      ? tabParam
      : "timeline";
  const setTab = useCallback(
    (next: TopTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "timeline") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.push(qs ? `/gallery?${qs}` : "/gallery", { scroll: false });
    },
    [router, searchParams],
  );
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [albums, setAlbums] = useState<AlbumWithCounts[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GalleryItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [albumPickerIds, setAlbumPickerIds] = useState<number[] | null>(null);
  const [compareItems, setCompareItems] = useState<GalleryItem[] | null>(null);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showSaveSmart, setShowSaveSmart] = useState(false);
  const [showBulkTag, setShowBulkTag] = useState(false);
  const [showBulkDate, setShowBulkDate] = useState(false);
  const [bulkShareSources, setBulkShareSources] = useState<ShareSource[] | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [memories, setMemories] = useState<MemoryGroup[]>([]);
  const [recent, setRecent] = useState<GalleryItem[]>([]);
  const [stats, setStats] = useState<GalleryStats | null>(null);
  const [importInfo, setImportInfo] = useState<{
    pending: string[];
    exists: boolean;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const refreshImportInfo = useCallback(async () => {
    const res = await fetch("/api/gallery/import-from-disk", {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (res.ok) setImportInfo(await res.json());
  }, []);

  useEffect(() => {
    refreshImportInfo();
  }, [refreshImportInfo]);

  const loadRecent = useCallback(async () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("gallery_recent_viewed");
    if (!raw) return;
    let ids: number[] = [];
    try {
      ids = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(ids) || ids.length === 0) return;
    const res = await fetch(
      `/api/gallery/items/by-ids?ids=${ids.slice(0, 30).join(",")}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (res.ok) {
      const data = await res.json();
      setRecent(data.items || []);
    }
  }, []);

  const pushRecent = useCallback((id: number) => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("gallery_recent_viewed");
    let list: number[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {}
    }
    if (!Array.isArray(list)) list = [];
    list = [id, ...list.filter((x) => x !== id)].slice(0, 30);
    localStorage.setItem("gallery_recent_viewed", JSON.stringify(list));
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const refreshStats = useCallback(async () => {
    const res = await fetch("/api/gallery/stats", {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = parseInt(localStorage.getItem("gallery_last_auto_purge") || "0", 10);
    if (!Number.isFinite(last) || Date.now() - last < 24 * 60 * 60 * 1000) return;
    fetch("/api/gallery/purge-trash?days=30", {
      method: "POST",
      headers: authHeaders(),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(() => {
        localStorage.setItem("gallery_last_auto_purge", String(Date.now()));
        refreshStats();
      })
      .catch(() => {});
  }, [refreshStats]);
  const [memoryView, setMemoryView] = useState<{
    items: GalleryItem[];
    index: number;
  } | null>(null);
  const [density, setDensity] = useState<"compact" | "normal" | "large">("normal");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const stored = localStorage.getItem("gallery_sort");
    if (stored === "asc" || stored === "desc") setSortOrder(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("gallery_sort", sortOrder);
  }, [sortOrder]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pageDragging, setPageDragging] = useState(false);
  const [pageUploading, setPageUploading] = useState<string | null>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem("gallery_density");
    if (stored === "compact" || stored === "normal" || stored === "large") {
      setDensity(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("gallery_density", density);
  }, [density]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/gallery/memories", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (res.ok && !cancelled) {
        const data = await res.json();
        setMemories(data.groups || []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTagFilter = useCallback(
    (tag: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tag) params.set("tag", tag);
      else params.delete("tag");
      const qs = params.toString();
      router.replace(qs ? `/gallery?${qs}` : "/gallery", { scroll: false });
    },
    [router, searchParams],
  );

  const setYearFilter = useCallback(
    (year: number | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (year) params.set("year", String(year));
      else params.delete("year");
      const qs = params.toString();
      router.replace(qs ? `/gallery?${qs}` : "/gallery", { scroll: false });
    },
    [router, searchParams],
  );

  const setDateRange = useCallback(
    (from: string | null, to: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (from) params.set("from", from);
      else params.delete("from");
      if (to) params.set("to", to);
      else params.delete("to");
      const qs = params.toString();
      router.replace(qs ? `/gallery?${qs}` : "/gallery", { scroll: false });
    },
    [router, searchParams],
  );

  const setMinRating = useCallback(
    (value: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value > 0 && value <= 5) params.set("minRating", String(value));
      else params.delete("minRating");
      const qs = params.toString();
      router.replace(qs ? `/gallery?${qs}` : "/gallery", { scroll: false });
    },
    [router, searchParams],
  );

  const refreshAllTags = useCallback(async () => {
    const res = await fetch("/api/gallery/tags", {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setAllTags((data.tags || []).map((t: { tag: string }) => t.tag));
    }
  }, []);

  useEffect(() => {
    refreshAllTags();
  }, [refreshAllTags]);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    const id = parseInt(openId, 10);
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/gallery/items/by-ids?ids=${id}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      const it = data.items?.[0];
      if (!it) return;
      setMemoryView({ items: [it], index: 0 });
      const params = new URLSearchParams(searchParams.toString());
      params.delete("open");
      const qs = params.toString();
      router.replace(qs ? `/gallery?${qs}` : "/gallery", { scroll: false });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isMediaTab = tab === "timeline" || tab === "favorites" || tab === "trash";
  const visibleItems = searchResults ?? items;

  const loadItems = useCallback(
    async (reset: boolean) => {
      if (!isMediaTab) return;
      if (loading) return;
      if (!reset && cursor === null && items.length > 0) return;
      setLoading(true);
      const params = new URLSearchParams({ tab, limit: "60", order: sortOrder });
      if (!reset && cursor) params.set("cursor", cursor);
      if (tagFilter) params.set("tag", tagFilter);
      if (yearFilter) params.set("year", String(yearFilter));
      if (fromFilter) params.set("from", fromFilter);
      if (toFilter) params.set("to", toFilter);
      if (minRatingFilter) params.set("minRating", String(minRatingFilter));
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
    [tab, cursor, loading, isMediaTab, items.length, tagFilter, yearFilter, sortOrder, fromFilter, toFilter, minRatingFilter],
  );

  const loadAlbums = useCallback(async () => {
    setAlbumsLoading(true);
    try {
      const res = await fetch("/api/gallery/albums", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setAlbums(data.albums || []);
      }
    } finally {
      setAlbumsLoading(false);
    }
  }, []);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setSearchResults(null);
    setSearchQuery("");
    setSelecting(false);
    setSelected(new Set());
    if (isMediaTab) loadItems(true);
    else if (tab === "albums") loadAlbums();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tagFilter, yearFilter, sortOrder, fromFilter, toFilter, minRatingFilter]);

  useEffect(() => {
    if (!isMediaTab) return;
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && cursor && !loading) {
        loadItems(false);
      }
    });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [cursor, loading, isMediaTab, loadItems]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/gallery/search?q=${encodeURIComponent(q)}`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const gridClass =
    density === "compact"
      ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1"
      : density === "large"
        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
        : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5";

  const showMemories =
    tab === "timeline" &&
    !tagFilter &&
    !yearFilter &&
    !minRatingFilter &&
    !fromFilter &&
    !toFilter &&
    !searchResults &&
    memories.length > 0;

  const hasActiveFilter = !!(
    tagFilter ||
    yearFilter ||
    fromFilter ||
    toFilter ||
    minRatingFilter
  );

  const availableYears = useMemo(() => {
    if (!stats?.oldest_taken_at || !stats?.newest_taken_at) return [];
    const oldest = new Date(stats.oldest_taken_at).getFullYear();
    const newest = new Date(stats.newest_taken_at).getFullYear();
    if (!Number.isFinite(oldest) || !Number.isFinite(newest)) return [];
    const years: number[] = [];
    for (let y = newest; y >= oldest; y--) years.push(y);
    return years;
  }, [stats?.oldest_taken_at, stats?.newest_taken_at]);

  const groupedSections = useMemo(() => {
    const groups = new Map<string, GalleryItem[]>();
    for (const it of visibleItems) {
      const key = dateGroupKey(it.taken_at);
      const arr = groups.get(key);
      if (arr) arr.push(it);
      else groups.set(key, [it]);
    }
    return Array.from(groups.entries()).map(([key, list]) => ({
      key,
      label: dateGroupLabel(key),
      items: list,
    }));
  }, [visibleItems]);

  const onItemClick = (item: GalleryItem, idx: number) => {
    if (selecting) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    } else {
      setLightboxIndex(idx);
      pushRecent(item.id);
    }
  };

  const updateItemInPlace = (updated: GalleryItem) => {
    setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSearchResults((prev) =>
      prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev,
    );
  };

  const removeItemFromList = (id: number) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setSearchResults((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  };

  const onToggleFavorite = async (item: GalleryItem) => {
    const next = item.is_favorite === 1 ? false : true;
    const res = await fetch(`/api/gallery/items/${item.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: next }),
    });
    if (res.ok) {
      const updated: GalleryItem = await res.json();
      if (tab === "favorites" && !next) {
        removeItemFromList(item.id);
        if (lightboxIndex !== null) setLightboxIndex(null);
      } else {
        updateItemInPlace(updated);
      }
    }
  };

  const onSoftDelete = async (item: GalleryItem) => {
    const res = await fetch(`/api/gallery/items/${item.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      removeItemFromList(item.id);
      if (lightboxIndex !== null) {
        const remaining = (searchResults ?? items).length - 1;
        if (lightboxIndex >= remaining) setLightboxIndex(null);
      }
      refreshStats();
    }
  };

  const onRestore = async (item: GalleryItem) => {
    const res = await fetch(`/api/gallery/items/${item.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    if (res.ok) {
      removeItemFromList(item.id);
      if (lightboxIndex !== null) {
        const remaining = (searchResults ?? items).length - 1;
        if (lightboxIndex >= remaining) setLightboxIndex(null);
      }
    }
  };

  const onHardDelete = async (item: GalleryItem) => {
    const res = await fetch(`/api/gallery/items/${item.id}?force=1`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      removeItemFromList(item.id);
      if (lightboxIndex !== null) {
        const remaining = (searchResults ?? items).length - 1;
        if (lightboxIndex >= remaining) setLightboxIndex(null);
      }
      refreshStats();
    }
  };

  const bulkSoftDelete = async () => {
    const ids = Array.from(selected);
    for (const id of ids) {
      const res = await fetch(`/api/gallery/items/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) removeItemFromList(id);
    }
    setSelected(new Set());
    setSelecting(false);
  };

  const bulkFavorite = async (favorite: boolean) => {
    const ids = Array.from(selected);
    for (const id of ids) {
      const res = await fetch(`/api/gallery/items/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: favorite }),
      });
      if (res.ok) {
        const updated: GalleryItem = await res.json();
        updateItemInPlace(updated);
      }
    }
    setSelected(new Set());
    setSelecting(false);
  };

  const bulkRate = async (rating: number) => {
    const ids = Array.from(selected);
    for (const id of ids) {
      const res = await fetch(`/api/gallery/items/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        const updated: GalleryItem = await res.json();
        updateItemInPlace(updated);
      }
    }
    setSelected(new Set());
    setSelecting(false);
  };

  const bulkSetTakenAt = async (
    payload: { taken_at?: string; shift_ms?: number },
  ) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return null;
    const res = await fetch("/api/gallery/items/bulk-taken-at", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: ids, ...payload }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setItems([]);
    setCursor(null);
    setSelected(new Set());
    setSelecting(false);
    refreshStats();
    return data as { updated: number; errors: { id: number; error: string }[] };
  };

  const emptyTrash = async () => {
    if (!confirm("Permanently delete everything in the trash?")) return;
    const res = await fetch("/api/gallery/items/empty-trash", {
      method: "POST",
      headers: authHeaders(),
    });
    if (res.ok) {
      setItems([]);
      setCursor(null);
      refreshStats();
    }
  };

  const runReorganize = async () => {
    if (!confirm("Move files on disk into yyyy/mm folders matching each item's taken_at date?")) return;
    const res = await fetch("/api/gallery/reorganize-files", {
      method: "POST",
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      alert(
        `Scanned ${data.scanned}, moved ${data.moved}${
          data.errors ? `, ${data.errors} errors` : ""
        }.`,
      );
    }
  };

  const runDedupe = async () => {
    if (
      !confirm(
        "Find duplicate photos (by SHA-256 content hash) and merge them?\n\nDuplicates will be moved to Trash. Tags, albums, trips and favorite status are merged onto the oldest copy.",
      )
    )
      return;
    const res = await fetch("/api/gallery/dedupe-duplicates", {
      method: "POST",
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const totalMerged =
        (data.backfill?.merged ?? 0) + (data.dedup?.merged ?? 0);
      alert(
        `Hashed ${data.backfill?.hashed ?? 0} new files (${data.backfill?.missing ?? 0} missing on disk).\n` +
          `Merged ${totalMerged} duplicate cop${totalMerged === 1 ? "y" : "ies"} into Trash.`,
      );
      setItems([]);
      setCursor(null);
      refreshStats();
    }
  };

  const runFilenameDates = async () => {
    if (
      !confirm(
        "Re-date items from dates embedded in their filenames (e.g. IMG-20250720-WA0000.jpg, 20250811_220838.mp4)?\n\nItems whose files carry an EXIF date are left untouched. Originals are moved to the matching yyyy/mm folder.",
      )
    )
      return;
    const res = await fetch("/api/gallery/backfill-filename-dates", {
      method: "POST",
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      alert(
        `Scanned ${data.scanned}, found filename dates on ${data.parsed}.\n` +
          `Updated ${data.updated} (${data.skipped_match} already correct, ${data.skipped_exif} kept their EXIF date).`,
      );
      if (data.updated > 0) {
        setItems([]);
        setCursor(null);
        refreshStats();
        if (tab === "timeline") loadItems(true);
      }
    }
  };

  const runImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const res = await fetch("/api/gallery/import-from-disk", {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        alert(
          `Imported ${data.imported} file${data.imported === 1 ? "" : "s"}${
            data.errors?.length ? ` (${data.errors.length} errors)` : ""
          }`,
        );
      }
    } finally {
      setImporting(false);
      await refreshImportInfo();
      if (tab === "timeline") loadItems(true);
      refreshStats();
    }
  };

  const uploadFiles = async (fileList: FileList) => {
    const list = Array.from(fileList);
    if (list.length === 0) return;
    setPageUploading(`Uploading 0 / ${list.length}…`);
    const queue = list.slice();
    let done = 0;
    const worker = async () => {
      while (true) {
        const file = queue.shift();
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        try {
          await fetch("/api/gallery/upload", {
            method: "POST",
            headers: authHeaders(),
            body: fd,
          });
        } catch {}
        done += 1;
        setPageUploading(`Uploading ${done} / ${list.length}…`);
      }
    };
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(8, list.length); i++) workers.push(worker());
    await Promise.all(workers);
    setPageUploading(null);
    if (tab === "timeline") loadItems(true);
    else setTab("timeline");
    refreshStats();
  };

  const onPageDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer) return;
    if (!Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    dragCounter.current += 1;
    setPageDragging(true);
  };

  const onPageDragLeave = () => {
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setPageDragging(false);
  };

  const onPageDragOver = (e: React.DragEvent) => {
    if (
      e.dataTransfer &&
      Array.from(e.dataTransfer.types || []).includes("Files")
    ) {
      e.preventDefault();
    }
  };

  const onPageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setPageDragging(false);
    if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div
      className="max-w-7xl mx-auto space-y-4 relative"
      onDragEnter={onPageDragEnter}
      onDragOver={onPageDragOver}
      onDragLeave={onPageDragLeave}
      onDrop={onPageDrop}
    >
      {pageDragging && (
        <div className="fixed inset-0 z-[80] bg-violet-500/20 backdrop-blur-sm border-4 border-dashed border-violet-400 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-900/90 rounded-xl px-6 py-5 border border-violet-400 text-white flex flex-col items-center gap-2">
            <CloudUpload className="w-10 h-10 text-violet-300" />
            <div className="text-lg font-medium">Drop to upload</div>
            <div className="text-xs text-gray-400">
              Photos and videos will be added to your gallery
            </div>
          </div>
        </div>
      )}
      {pageUploading && (
        <div className="fixed bottom-4 right-4 z-[80] bg-gray-900 border border-violet-500 rounded-lg px-4 py-2 text-sm text-white flex items-center gap-2 shadow-xl">
          <Loader2 className="w-4 h-4 animate-spin text-violet-300" />
          {pageUploading}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Album className="w-6 h-6 text-violet-300" /> My photos
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search filename, date, tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-md pl-7 pr-3 py-1.5 text-sm text-white w-56 focus:outline-none focus:border-violet-400"
            />
          </div>
          <div className="hidden sm:flex bg-gray-900 border border-gray-700 rounded-md overflow-hidden">
            {(
              [
                { key: "compact", icon: Grid3x3, label: "Compact" },
                { key: "normal", icon: Grid2x2, label: "Normal" },
                { key: "large", icon: LayoutGrid, label: "Large" },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setDensity(key)}
                title={label}
                aria-label={label}
                className={`px-2 py-1.5 ${
                  density === key
                    ? "bg-violet-600/30 text-violet-200"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <button
            onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
            className="px-2 py-1.5 rounded-md bg-gray-900 border border-gray-700 text-gray-200 hover:border-gray-500 text-sm flex items-center gap-1"
            title={
              sortOrder === "desc"
                ? "Newest first — click to flip"
                : "Oldest first — click to flip"
            }
            aria-label="Sort order"
          >
            {sortOrder === "desc" ? (
              <ArrowDownAZ className="w-4 h-4" />
            ) : (
              <ArrowUpAZ className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => {
              setSelecting((v) => !v);
              setSelected(new Set());
            }}
            className={`px-3 py-1.5 rounded-md text-sm border ${
              selecting
                ? "bg-violet-600 border-violet-500 text-white"
                : "bg-gray-900 border-gray-700 text-gray-200 hover:border-gray-500"
            }`}
          >
            <CheckSquare className="w-4 h-4 inline-block mr-1" />
            {selecting ? "Done" : "Select"}
          </button>
        </div>
      </div>

      {stats && stats.total_items > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
          <span>
            <span className="text-white">{stats.total_items}</span>{" "}
            {stats.total_items === 1 ? "item" : "items"}
          </span>
          <span>
            <span className="text-white">{stats.image_count}</span> photos ·{" "}
            <span className="text-white">{stats.video_count}</span> videos
          </span>
          <span>
            <span className="text-white">{formatBytes(stats.total_size_bytes)}</span>{" "}
            stored
          </span>
          {stats.album_count > 0 && (
            <span>
              <span className="text-white">{stats.album_count}</span>{" "}
              {stats.album_count === 1 ? "album" : "albums"}
            </span>
          )}
          {stats.trash_count > 0 && (
            <span className="text-red-300/80">
              {stats.trash_count} in trash ({formatBytes(stats.trash_size_bytes)})
            </span>
          )}
          {stats.oldest_taken_at && stats.newest_taken_at && (
            <span>
              {new Date(stats.oldest_taken_at).getFullYear()} –{" "}
              {new Date(stats.newest_taken_at).getFullYear()}
            </span>
          )}
          <button
            onClick={runReorganize}
            className="text-gray-500 hover:text-violet-300 underline-offset-2 hover:underline"
            title="Move originals on disk into yyyy/mm folders matching their taken_at"
          >
            Reorganize folders
          </button>
          <button
            onClick={runDedupe}
            className="text-gray-500 hover:text-violet-300 underline-offset-2 hover:underline"
            title="Find duplicate photos by content hash and merge them into Trash"
          >
            Find duplicates
          </button>
          <button
            onClick={runFilenameDates}
            className="text-gray-500 hover:text-violet-300 underline-offset-2 hover:underline"
            title="Re-date items from dates embedded in filenames (IMG-20250720-WA0000, 20250811_220838, …) when EXIF has none"
          >
            Fix dates from filenames
          </button>
        </div>
      )}

      {importInfo?.exists && importInfo.pending.length > 0 && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-center gap-3 text-sm">
          <CloudUpload className="w-5 h-5 text-emerald-300" />
          <div className="flex-1">
            <div className="text-emerald-100 font-medium">
              {importInfo.pending.length} file
              {importInfo.pending.length === 1 ? "" : "s"} waiting in{" "}
              <code className="text-xs">/mnt/4tb/elite/import</code>
            </div>
            <div className="text-xs text-gray-400">
              Server-side import preserves full EXIF (incl. GPS) — bypasses
              browser/Photo Picker stripping.
            </div>
          </div>
          <button
            onClick={runImport}
            disabled={importing}
            className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm flex items-center gap-1 disabled:opacity-50"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Importing…
              </>
            ) : (
              <>Import {importInfo.pending.length}</>
            )}
          </button>
        </div>
      )}

      <UploadDropzone
        onUploaded={() => {
          if (tab === "timeline") loadItems(true);
          else setTab("timeline");
          refreshStats();
        }}
      />

      <div className="flex flex-wrap gap-1 border-b border-gray-800">
        {TAB_DEFS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm flex items-center gap-1.5 border-b-2 -mb-px ${
              tab === key
                ? "border-violet-400 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
        <Link
          href="/gallery/tags"
          className="px-3 py-2 text-sm flex items-center gap-1.5 border-b-2 -mb-px border-transparent text-gray-400 hover:text-gray-200"
        >
          <Tag className="w-4 h-4" /> Tags
        </Link>
        <Link
          href="/gallery/map"
          className="px-3 py-2 text-sm flex items-center gap-1.5 border-b-2 -mb-px border-transparent text-gray-400 hover:text-gray-200"
        >
          <MapPin className="w-4 h-4" /> Map
        </Link>
        <Link
          href="/gallery/trips"
          className="px-3 py-2 text-sm flex items-center gap-1.5 border-b-2 -mb-px border-transparent text-gray-400 hover:text-gray-200"
        >
          <Plane className="w-4 h-4" /> Trips
        </Link>
        {tab === "trash" && visibleItems.length > 0 && (
          <div className="ml-auto flex items-center gap-2 my-1">
            <button
              onClick={async () => {
                const res = await fetch("/api/gallery/purge-trash?days=30", {
                  method: "POST",
                  headers: authHeaders(),
                });
                if (res.ok) {
                  const data = await res.json();
                  if (tab === "trash") loadItems(true);
                  refreshStats();
                  if (data.purged > 0) {
                    alert(`Purged ${data.purged} item(s) older than 30 days.`);
                  } else {
                    alert("Nothing older than 30 days in the trash.");
                  }
                }
              }}
              className="px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 text-gray-300 rounded-md hover:border-red-500 hover:text-red-300"
              title="Permanently delete items older than 30 days"
            >
              Purge 30+ days
            </button>
            <button
              onClick={emptyTrash}
              className="px-3 py-1.5 text-sm bg-red-600/20 text-red-300 border border-red-600/40 rounded-md hover:bg-red-600/30"
            >
              Empty trash
            </button>
          </div>
        )}
      </div>

      {isMediaTab && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-400">Filter:</span>
          {tagFilter && (
            <span className="inline-flex items-center gap-1 bg-violet-500/20 border border-violet-500/40 text-violet-200 rounded-full pl-2.5 pr-1 py-0.5">
              <Tag className="w-3 h-3" />
              {tagFilter}
              <button
                onClick={() => setTagFilter(null)}
                className="ml-1 hover:bg-white/10 rounded-full p-0.5"
                aria-label="Clear tag filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {yearFilter && (
            <>
              <span className="inline-flex items-center gap-1 bg-sky-500/20 border border-sky-500/40 text-sky-200 rounded-full pl-2.5 pr-1 py-0.5">
                {yearFilter}
                <button
                  onClick={() => setYearFilter(null)}
                  className="ml-1 hover:bg-white/10 rounded-full p-0.5"
                  aria-label="Clear year filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
              <Link
                href={`/gallery/year/${yearFilter}`}
                className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
              >
                Year review →
              </Link>
            </>
          )}
          <div className="inline-flex items-center gap-1 text-xs text-gray-400">
            <span>Rating</span>
            <div className="inline-flex items-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setMinRating(minRatingFilter === n ? 0 : n)}
                  className="p-0.5 hover:scale-110 transition-transform"
                  aria-label={`Min rating ${n}`}
                  title={
                    minRatingFilter === n
                      ? `Clear filter (currently ≥${n})`
                      : `Filter to items rated ≥${n}`
                  }
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      minRatingFilter >= n
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-600"
                    }`}
                  />
                </button>
              ))}
            </div>
            {minRatingFilter > 0 && (
              <button
                onClick={() => setMinRating(0)}
                className="ml-0.5 hover:text-gray-200"
                aria-label="Clear rating filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <label className="inline-flex items-center gap-1 text-xs text-gray-400">
            From
            <input
              type="date"
              value={fromFilter}
              onChange={(e) => setDateRange(e.target.value || null, toFilter || null)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-400"
            />
          </label>
          <label className="inline-flex items-center gap-1 text-xs text-gray-400">
            To
            <input
              type="date"
              value={toFilter}
              onChange={(e) => setDateRange(fromFilter || null, e.target.value || null)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-400"
            />
          </label>
          {(fromFilter || toFilter) && (
            <button
              onClick={() => setDateRange(null, null)}
              className="text-xs text-gray-500 hover:text-gray-200"
            >
              clear dates
            </button>
          )}
          {hasActiveFilter && (
            <button
              onClick={() => setShowSaveSmart(true)}
              className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
              title={
                smartAlbumId
                  ? "Update this smart album with current filters"
                  : "Save current filters as a smart album"
              }
            >
              <Save className="w-3 h-3" />
              {smartAlbumId ? "Update smart" : "Save filter"}
            </button>
          )}
        </div>
      )}

      {selecting && selected.size > 0 && (
        <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-md px-3 py-2 flex flex-wrap items-center gap-2 text-sm text-white">
          <span>{selected.size} selected</span>
          <div className="flex-1" />
          {tab !== "trash" && (
            <>
              <button
                onClick={() => bulkFavorite(true)}
                className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
              >
                <Star className="w-4 h-4 inline mr-1" /> Favorite
              </button>
              <button
                onClick={() => setAlbumPickerIds(Array.from(selected))}
                className="px-2 py-1 rounded bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
              >
                <FolderPlus className="w-4 h-4 inline mr-1" /> Add to album
              </button>
              <button
                onClick={() => setShowBulkTag(true)}
                className="px-2 py-1 rounded bg-sky-500/20 text-sky-200 hover:bg-sky-500/30"
              >
                <Tag className="w-4 h-4 inline mr-1" /> Add tag
              </button>
              <div className="inline-flex items-center bg-yellow-500/10 border border-yellow-500/30 rounded px-1">
                <span className="text-[10px] text-yellow-300/70 px-1">Rate</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => bulkRate(n)}
                    className="p-0.5 hover:scale-110 transition-transform"
                    title={`Rate selected ${n} ${n === 1 ? "star" : "stars"}`}
                  >
                    <Star className="w-3.5 h-3.5 text-yellow-400" />
                  </button>
                ))}
                <button
                  onClick={() => bulkRate(0)}
                  className="ml-0.5 text-[10px] text-yellow-300/70 hover:text-yellow-200 px-1"
                  title="Clear rating on selected"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <button
                onClick={() => setShowBulkDate(true)}
                className="px-2 py-1 rounded bg-teal-500/20 text-teal-200 hover:bg-teal-500/30"
              >
                <Calendar className="w-4 h-4 inline mr-1" /> Set date
              </button>
              <a
                href={`/api/gallery/download?ids=${Array.from(selected).join(
                  ",",
                )}&t=${encodeURIComponent(mediaToken())}`}
                className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 flex items-center"
              >
                <Download className="w-4 h-4 inline mr-1" /> Download
              </a>
              <button
                onClick={() => {
                  const ids = Array.from(selected);
                  const items = ids
                    .map((id) => visibleItems.find((v) => v.id === id))
                    .filter((it): it is GalleryItem => Boolean(it));
                  if (items.length === 0) return;
                  setBulkShareSources(items.map((it) => ({
                    kind: "gallery",
                    galleryItemId: it.id,
                    mediaType: it.mime_type,
                    mediaName: it.filename,
                    previewUrl: previewUrl(it),
                  })));
                }}
                className="px-2 py-1 rounded bg-pink-500/20 text-pink-200 hover:bg-pink-500/30 flex items-center"
              >
                <Share2 className="w-4 h-4 inline mr-1" />
                Share{selected.size > 1 ? ` ${selected.size}` : ""}
              </button>
              {selected.size === 2 && (
                <button
                  onClick={() => {
                    const ids = Array.from(selected);
                    const pair = visibleItems.filter((it) => ids.includes(it.id));
                    if (pair.length === 2) setCompareItems(pair);
                  }}
                  className="px-2 py-1 rounded bg-fuchsia-500/20 text-fuchsia-200 hover:bg-fuchsia-500/30"
                >
                  Compare
                </button>
              )}
              <button
                onClick={bulkSoftDelete}
                className="px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
              >
                <Trash2 className="w-4 h-4 inline mr-1" /> Delete
              </button>
            </>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="px-2 py-1 rounded hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {tab === "timeline" && !tagFilter && !searchResults && recent.length >= 2 && (
        <RecentStrip
          items={recent}
          onOpen={(idx) => {
            pushRecent(recent[idx].id);
            setMemoryView({ items: recent, index: idx });
          }}
          onClear={() => {
            localStorage.removeItem("gallery_recent_viewed");
            setRecent([]);
          }}
        />
      )}

      {showMemories && (
        <MemoriesStrip
          groups={memories}
          onOpen={(group, idx) => {
            pushRecent(group.items[idx].id);
            setMemoryView({ items: group.items, index: idx });
          }}
        />
      )}

      {isMediaTab && (
        <>
          {searching && (
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          )}

          {visibleItems.length === 0 && !loading ? (
            <div className="rounded-md border border-gray-800 p-8 text-center text-gray-400 text-sm">
              {tagFilter
                ? `No items tagged "${tagFilter}".`
                : tab === "trash"
                  ? "Trash is empty."
                  : tab === "favorites"
                    ? "No favorites yet. Star items to find them here."
                    : searchResults
                      ? "No matches."
                      : "No photos yet. Upload some to get started."}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedSections.map((section) => (
                <section key={section.key}>
                  <h2 className="sticky top-0 z-10 -mx-2 px-2 py-1.5 text-sm text-gray-200 font-medium bg-gray-950/90 backdrop-blur supports-[backdrop-filter]:bg-gray-950/70 mb-2">
                    {section.label}
                  </h2>
                  <div className={gridClass}>
                    {section.items.map((it) => {
                      const idx = visibleItems.indexOf(it);
                      return (
                        <ItemTile
                          key={it.id}
                          item={it}
                          selecting={selecting}
                          selected={selected.has(it.id)}
                          onClick={() => onItemClick(it, idx)}
                          onLongPress={() => {
                            if (!selecting) setSelecting(true);
                            setSelected((prev) => {
                              const next = new Set(prev);
                              next.add(it.id);
                              return next;
                            });
                          }}
                          onToggleFavorite={
                            tab === "trash" ? undefined : () => onToggleFavorite(it)
                          }
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
              {!searchResults && (
                <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                  {loading && <Loader2 className="w-5 h-5 animate-spin text-gray-500" />}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "albums" && (
        <AlbumsTab
          albums={albums}
          loading={albumsLoading}
          onCreate={() => setShowCreateAlbum(true)}
        />
      )}

      {isMediaTab && availableYears.length >= 2 && (
        <YearScrubber
          years={availableYears}
          current={yearFilter}
          onSelect={setYearFilter}
        />
      )}

      {compareItems && (
        <CompareView
          items={compareItems}
          onClose={() => setCompareItems(null)}
        />
      )}

      {memoryView && (
        <Lightbox
          items={memoryView.items}
          index={memoryView.index}
          onClose={() => setMemoryView(null)}
          onChangeIndex={(i) =>
            setMemoryView((prev) => (prev ? { ...prev, index: i } : prev))
          }
          onToggleFavorite={async (it) => {
            const next = it.is_favorite === 1 ? false : true;
            const res = await fetch(`/api/gallery/items/${it.id}`, {
              method: "PATCH",
              headers: { ...authHeaders(), "Content-Type": "application/json" },
              body: JSON.stringify({ is_favorite: next }),
            });
            if (res.ok) {
              const updated: GalleryItem = await res.json();
              setMemoryView((prev) =>
                prev
                  ? {
                      ...prev,
                      items: prev.items.map((p) =>
                        p.id === updated.id ? updated : p,
                      ),
                    }
                  : prev,
              );
            }
          }}
          fileUrl={fileUrlForLightbox}
          allTags={allTags}
          authHeaders={authHeaders}
          onAddToAlbum={(it) => {
            setMemoryView(null);
            setAlbumPickerIds([it.id]);
          }}
          onTagClick={(t) => {
            setMemoryView(null);
            if (tab !== "timeline") setTab("timeline");
            setTagFilter(t);
          }}
        />
      )}

      {lightboxIndex !== null && visibleItems[lightboxIndex] && (
        <Lightbox
          items={visibleItems}
          index={lightboxIndex}
          onClose={() => {
            setLightboxIndex(null);
            refreshAllTags();
          }}
          onChangeIndex={setLightboxIndex}
          onToggleFavorite={onToggleFavorite}
          onSoftDelete={tab === "trash" ? undefined : onSoftDelete}
          onRestore={tab === "trash" ? onRestore : undefined}
          onHardDelete={tab === "trash" ? onHardDelete : undefined}
          fileUrl={fileUrlForLightbox}
          allTags={allTags}
          authHeaders={authHeaders}
          onAddToAlbum={(it) => setAlbumPickerIds([it.id])}
          onTagClick={(t) => {
            setLightboxIndex(null);
            if (tab !== "timeline") setTab("timeline");
            setTagFilter(t);
          }}
          onRotated={(updated) => updateItemInPlace(updated)}
        />
      )}

      {albumPickerIds && (
        <AlbumPickerModal
          onClose={() => setAlbumPickerIds(null)}
          onPick={async (albumId) => {
            await fetch(`/api/gallery/albums/${albumId}/items`, {
              method: "POST",
              headers: { ...authHeaders(), "Content-Type": "application/json" },
              body: JSON.stringify({ itemIds: albumPickerIds }),
            });
            setAlbumPickerIds(null);
            if (selecting) {
              setSelected(new Set());
              setSelecting(false);
            }
          }}
          onCreateNew={() => {
            setShowCreateAlbum(true);
          }}
        />
      )}

      {showBulkTag && (
        <BulkTagModal
          allTags={allTags}
          onClose={() => setShowBulkTag(false)}
          onSubmit={async (tag) => {
            const res = await fetch("/api/gallery/tags", {
              method: "POST",
              headers: { ...authHeaders(), "Content-Type": "application/json" },
              body: JSON.stringify({ tag, itemIds: Array.from(selected) }),
            });
            if (res.ok) {
              setShowBulkTag(false);
              setSelected(new Set());
              setSelecting(false);
              await refreshAllTags();
              return true;
            }
            return false;
          }}
        />
      )}

      {showBulkDate && (
        <BulkDateModal
          count={selected.size}
          onClose={() => setShowBulkDate(false)}
          onSubmit={async (payload) => {
            const result = await bulkSetTakenAt(payload);
            if (result) {
              setShowBulkDate(false);
              return result;
            }
            return null;
          }}
        />
      )}

      {showCreateAlbum && (
        <CreateAlbumModal
          onClose={() => setShowCreateAlbum(false)}
          onCreated={async (album) => {
            setShowCreateAlbum(false);
            const ids = albumPickerIds ?? Array.from(selected);
            if (ids.length > 0) {
              await fetch(`/api/gallery/albums/${album.id}/items`, {
                method: "POST",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ itemIds: ids }),
              });
              setAlbumPickerIds(null);
              if (selecting) {
                setSelected(new Set());
                setSelecting(false);
              }
            }
            await loadAlbums();
            if (!albumPickerIds) setTab("albums");
          }}
        />
      )}

      {showSaveSmart && (
        <SaveSmartAlbumModal
          existingId={smartAlbumId || null}
          filters={{
            tag: tagFilter || undefined,
            year: yearFilter ?? undefined,
            from: fromFilter || undefined,
            to: toFilter || undefined,
            minRating: minRatingFilter || undefined,
            tab: tab === "favorites" ? "favorites" : undefined,
          }}
          suggestedName={smartAlbumDescribe(
            tagFilter || null,
            yearFilter,
            fromFilter || null,
            toFilter || null,
            minRatingFilter || 0,
          )}
          onClose={() => setShowSaveSmart(false)}
          onSaved={(album) => {
            setShowSaveSmart(false);
            const next = new URLSearchParams(searchParams.toString());
            next.set("smart", String(album.id));
            const qs = next.toString();
            router.replace(qs ? `/gallery?${qs}` : "/gallery", { scroll: false });
          }}
        />
      )}

      <ShareTargetModal
        open={bulkShareSources !== null}
        source={bulkShareSources?.[0] ?? null}
        sources={bulkShareSources ?? undefined}
        onClose={() => {
          setBulkShareSources(null);
          setSelected(new Set());
        }}
      />
    </div>
  );
}

function smartAlbumDescribe(
  tag: string | null,
  year: number | null,
  from: string | null,
  to: string | null,
  minRating: number,
): string {
  const parts: string[] = [];
  if (tag) parts.push(`#${tag}`);
  if (year) parts.push(String(year));
  if (minRating) parts.push(`${minRating}★+`);
  if (from && to) parts.push(`${from} → ${to}`);
  else if (from) parts.push(`from ${from}`);
  else if (to) parts.push(`until ${to}`);
  return parts.join(" · ") || "Smart album";
}

function SaveSmartAlbumModal({
  existingId,
  filters,
  suggestedName,
  onClose,
  onSaved,
}: {
  existingId: number | null;
  filters: Record<string, unknown>;
  suggestedName: string;
  onClose: () => void;
  onSaved: (album: { id: number; name: string }) => void;
}) {
  const [name, setName] = useState(suggestedName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const cleaned = name.trim();
    if (!cleaned) {
      setError("Name required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = existingId
        ? `/api/gallery/smart-albums/${existingId}`
        : "/api/gallery/smart-albums";
      const method = existingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleaned, filters }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Failed to save");
        return;
      }
      const data = await res.json();
      onSaved(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Filter className="w-4 h-4 text-violet-300" />
            {existingId ? "Update smart album" : "Save filter as smart album"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-xs text-gray-400 space-y-1">
          <div>Filters captured:</div>
          <div className="text-violet-200 font-mono text-xs bg-black/30 rounded p-2 break-all">
            {JSON.stringify(filters, null, 2)}
          </div>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") onClose();
          }}
          placeholder="Smart album name"
          autoFocus
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-400"
        />
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="px-3 py-1.5 rounded text-sm bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : existingId ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompareView({
  items,
  onClose,
}: {
  items: GalleryItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 text-white text-sm">
        <div className="font-medium">Compare</div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-white/10"
          aria-label="Close compare"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-1 bg-black">
        {items.map((it) => (
          <div
            key={it.id}
            className="relative flex items-center justify-center overflow-hidden bg-gray-950"
          >
            {it.kind === "video" ? (
              <video
                src={originalUrl(it)}
                controls
                playsInline
                className="max-h-full max-w-full"
              />
            ) : (
              <img
                src={previewUrl(it)}
                alt={it.filename}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent text-xs text-white">
              <div className="font-medium truncate">{it.filename}</div>
              <div className="text-gray-300">
                {new Date(it.taken_at).toLocaleString()}
                {it.width && it.height ? ` · ${it.width}×${it.height}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function YearScrubber({
  years,
  current,
  onSelect,
}: {
  years: number[];
  current: number | null;
  onSelect: (year: number | null) => void;
}) {
  return (
    <div className="hidden lg:flex flex-col gap-0.5 fixed right-3 top-1/2 -translate-y-1/2 z-20 bg-gray-900/85 backdrop-blur border border-gray-800 rounded-lg p-1.5 max-h-[70vh] overflow-y-auto">
      <button
        onClick={() => onSelect(null)}
        className={`px-2 py-1 rounded text-xs ${
          current === null
            ? "bg-violet-500/30 text-violet-100"
            : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
        }`}
      >
        All
      </button>
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onSelect(y)}
          className={`px-2 py-1 rounded text-xs ${
            current === y
              ? "bg-violet-500/30 text-violet-100"
              : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

function RecentStrip({
  items,
  onOpen,
  onClear,
}: {
  items: GalleryItem[];
  onOpen: (idx: number) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-violet-300" />
          <span className="text-white font-medium">Recently viewed</span>
          <span className="text-gray-400 text-xs">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Clear
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {items.map((it, idx) => (
          <button
            key={it.id}
            onClick={() => onOpen(idx)}
            className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded overflow-hidden bg-gray-800 group"
          >
            <img
              src={thumbUrl(it)}
              alt={it.filename}
              loading="lazy"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            {it.kind === "video" && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent">
                <Play className="w-5 h-5 text-white drop-shadow" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function MemoriesStrip({
  groups,
  onOpen,
}: {
  groups: MemoryGroup[];
  onOpen: (group: MemoryGroup, index: number) => void;
}) {
  return (
    <div className="rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="w-4 h-4 text-violet-300" />
        <span className="text-white font-medium">On this day</span>
        <span className="text-gray-400 text-xs">
          {groups.length === 1
            ? "1 memory"
            : `${groups.length} memories`}
        </span>
      </div>
      <div className="space-y-3">
        {groups.map((g) => (
          <section key={g.year}>
            <div className="text-xs text-violet-200 mb-1.5 font-medium">
              {g.years_ago === 1 ? "1 year ago" : `${g.years_ago} years ago`} ·{" "}
              <span className="text-gray-400 font-normal">{g.year}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {g.items.map((it, idx) => (
                <button
                  key={it.id}
                  onClick={() => onOpen(g, idx)}
                  className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-900 group"
                >
                  <img
                    src={thumbUrl(it)}
                    alt={it.filename}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  {it.kind === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent">
                      <Play className="w-6 h-6 text-white drop-shadow" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ItemTile({
  item,
  selecting,
  selected,
  onClick,
  onLongPress,
  onToggleFavorite,
}: {
  item: GalleryItem;
  selecting: boolean;
  selected: boolean;
  onClick: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const startTouch = useRef<{ x: number; y: number } | null>(null);

  const startLongPress = (e: React.TouchEvent) => {
    longPressed.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (e.touches.length !== 1 || !onLongPress) return;
    startTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      if (navigator.vibrate) navigator.vibrate(40);
      onLongPress();
    }, 450);
  };

  const moveLongPress = (e: React.TouchEvent) => {
    const start = startTouch.current;
    if (!start || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    startTouch.current = null;
  };

  return (
    <button
      type="button"
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        onClick();
      }}
      onTouchStart={startLongPress}
      onTouchMove={moveLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onContextMenu={(e) => {
        if (onLongPress) {
          e.preventDefault();
          onLongPress();
        }
      }}
      className={`relative aspect-square rounded overflow-hidden bg-gray-900 group ${
        selected ? "ring-2 ring-violet-400" : ""
      }`}
    >
      <img
        src={thumbUrl(item)}
        alt={item.filename}
        loading="lazy"
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
      />
      {item.kind === "video" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent">
          <Play className="w-7 h-7 text-white drop-shadow" />
        </div>
      )}
      {onToggleFavorite && !selecting ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label={
            item.is_favorite === 1 ? "Unfavorite" : "Favorite"
          }
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={`absolute top-1 right-1 p-1 rounded-full bg-black/40 hover:bg-black/70 transition-opacity ${
            item.is_favorite === 1
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <Star
            className={`w-4 h-4 ${
              item.is_favorite === 1
                ? "fill-yellow-400 text-yellow-400"
                : "text-white"
            }`}
          />
        </span>
      ) : (
        item.is_favorite === 1 && (
          <Star className="absolute top-1 right-1 w-4 h-4 fill-yellow-400 text-yellow-400 drop-shadow" />
        )
      )}
      {(item.tag_count ?? 0) > 0 && (
        <div className="absolute bottom-1 right-1 bg-black/60 text-violet-200 rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-0.5 drop-shadow">
          <Tag className="w-3 h-3" />
          {item.tag_count}
        </div>
      )}
      {item.rating > 0 && (
        <div className="absolute bottom-1 left-1 bg-black/60 text-yellow-300 rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-0.5 drop-shadow">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          {item.rating}
        </div>
      )}
      {selecting && (
        <div className="absolute top-1 left-1 bg-black/60 rounded">
          {selected ? (
            <CheckSquare className="w-5 h-5 text-violet-300" />
          ) : (
            <Square className="w-5 h-5 text-white/80" />
          )}
        </div>
      )}
    </button>
  );
}

interface SmartAlbumSummary {
  id: number;
  name: string;
  filters: Record<string, unknown>;
  item_count: number;
  cover_storage_key: string | null;
  cover_kind: "image" | "video" | null;
  updated_at: string;
}

function AlbumsTab({
  albums,
  loading,
  onCreate,
}: {
  albums: AlbumWithCounts[];
  loading: boolean;
  onCreate: () => void;
}) {
  const [smartAlbums, setSmartAlbums] = useState<SmartAlbumSummary[]>([]);
  const [smartLoading, setSmartLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSmartLoading(true);
    fetch("/api/gallery/smart-albums", {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { smartAlbums: [] }))
      .then((data) => {
        if (!cancelled) setSmartAlbums(data.smartAlbums || []);
      })
      .finally(() => {
        if (!cancelled) setSmartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const deleteSmart = async (id: number) => {
    if (!confirm("Delete this smart album?")) return;
    const res = await fetch(`/api/gallery/smart-albums/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) setSmartAlbums((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">{albums.length} albums</div>
          <button
            onClick={onCreate}
            className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-sm text-white flex items-center gap-1"
          >
            <PlusCircle className="w-4 h-4" /> New album
          </button>
        </div>
        {loading ? (
          <div className="mt-3 text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : albums.length === 0 ? (
          <div className="mt-3 rounded-md border border-gray-800 p-8 text-center text-gray-400 text-sm">
            No albums yet. Create one and add photos to it.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/gallery/albums/${album.id}`}
                className="group rounded-lg overflow-hidden bg-gray-900 border border-gray-800 hover:border-gray-600 transition-colors"
              >
                <div className="aspect-square bg-gray-800 relative">
                  {album.cover_storage_key ? (
                    <img
                      src={`/api/gallery/thumb/${album.cover_storage_key}?t=${encodeURIComponent(
                        mediaToken(),
                      )}`}
                      alt={album.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Album className="w-10 h-10 text-gray-600" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-sm text-white truncate">{album.name}</div>
                  <div className="text-xs text-gray-400">{album.item_count} items</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {smartAlbums.length} smart {smartAlbums.length === 1 ? "album" : "albums"}
          </div>
          <span className="text-xs text-gray-500">Saved filter combos</span>
        </div>
        {smartLoading ? (
          <div className="mt-3 text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : smartAlbums.length === 0 ? (
          <div className="mt-3 rounded-md border border-gray-800 border-dashed p-6 text-center text-gray-500 text-xs">
            Apply filters in the timeline (tag, year, rating, dates) and click
            "Save filter" to build your first smart album.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {smartAlbums.map((album) => (
              <div
                key={album.id}
                className="group relative rounded-lg overflow-hidden bg-gray-900 border border-violet-900/40 hover:border-violet-500 transition-colors"
              >
                <Link href={`/gallery/smart/${album.id}`} className="block">
                  <div className="aspect-square bg-gray-800 relative">
                    {album.cover_storage_key ? (
                      <img
                        src={`/api/gallery/thumb/${album.cover_storage_key}?t=${encodeURIComponent(
                          mediaToken(),
                        )}`}
                        alt={album.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Filter className="w-10 h-10 text-violet-700" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1 bg-violet-500/80 text-white rounded-full p-0.5">
                      <Filter className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="text-sm text-white truncate">{album.name}</div>
                    <div className="text-xs text-gray-400">{album.item_count} items</div>
                  </div>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteSmart(album.id);
                  }}
                  className="absolute top-1 right-1 p-1 rounded bg-black/50 text-gray-300 hover:bg-red-600/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete smart album"
                  title="Delete smart album"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AlbumPickerModal({
  onClose,
  onPick,
  onCreateNew,
}: {
  onClose: () => void;
  onPick: (id: number) => void;
  onCreateNew: () => void;
}) {
  const [albums, setAlbums] = useState<AlbumWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/gallery/albums", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setAlbums(data.albums || []);
      }
      setLoading(false);
    })();
  }, []);
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-medium text-white">Add to album</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-4 text-sm text-gray-400">Loading…</div>
          ) : albums.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">No albums yet.</div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {albums.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => onPick(a.id)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded bg-gray-800 overflow-hidden flex-shrink-0">
                      {a.cover_storage_key ? (
                        <img
                          src={`/api/gallery/thumb/${a.cover_storage_key}?t=${encodeURIComponent(
                            mediaToken(),
                          )}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Album className="w-5 h-5 m-auto mt-2.5 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{a.name}</div>
                      <div className="text-xs text-gray-400">
                        {a.item_count} items
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={onCreateNew}
            className="w-full px-3 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-sm text-white flex items-center justify-center gap-1"
          >
            <PlusCircle className="w-4 h-4" /> Create new album
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkTagModal({
  allTags,
  onClose,
  onSubmit,
}: {
  allTags: string[];
  onClose: () => void;
  onSubmit: (tag: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = value.trim()
    ? allTags.filter((t) => t.startsWith(value.trim().toLowerCase())).slice(0, 8)
    : allTags.slice(0, 8);

  const submit = async (override?: string) => {
    const tag = (override ?? value).trim();
    if (!tag || busy) return;
    setBusy(true);
    setError(null);
    const ok = await onSubmit(tag);
    setBusy(false);
    if (!ok) setError("Invalid tag (letters, digits, space, dash, underscore)");
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-sm">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-medium text-white flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-sky-300" /> Add tag
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="e.g. vacation"
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-violet-400"
          />
          {error && <p className="text-xs text-red-300">{error}</p>}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setValue(t);
                    submit(t);
                  }}
                  className="px-2 py-0.5 rounded-full text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => submit()}
            disabled={busy || !value.trim()}
            className="px-3 py-1.5 rounded-md text-sm bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkDateModal({
  count,
  onClose,
  onSubmit,
}: {
  count: number;
  onClose: () => void;
  onSubmit: (
    payload: { taken_at?: string; shift_ms?: number },
  ) => Promise<{ updated: number; errors: { id: number; error: string }[] } | null>;
}) {
  const [mode, setMode] = useState<"absolute" | "shift">("absolute");
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaultLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const [dateValue, setDateValue] = useState(defaultLocal);
  const [shiftDays, setShiftDays] = useState("0");
  const [shiftHours, setShiftHours] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    let payload: { taken_at?: string; shift_ms?: number };
    if (mode === "absolute") {
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) {
        setError("Invalid date");
        setBusy(false);
        return;
      }
      payload = { taken_at: d.toISOString() };
    } else {
      const days = parseInt(shiftDays, 10);
      const hours = parseInt(shiftHours, 10);
      if (!Number.isFinite(days) || !Number.isFinite(hours)) {
        setError("Invalid offset");
        setBusy(false);
        return;
      }
      const ms = (days * 24 + hours) * 60 * 60 * 1000;
      if (ms === 0) {
        setError("Offset cannot be zero");
        setBusy(false);
        return;
      }
      payload = { shift_ms: ms };
    }
    const result = await onSubmit(payload);
    setBusy(false);
    if (!result) {
      setError("Request failed");
      return;
    }
    setDone(
      `Updated ${result.updated} item${result.updated === 1 ? "" : "s"}` +
        (result.errors.length > 0 ? `, ${result.errors.length} errors` : ""),
    );
    setTimeout(onClose, 800);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-sm">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-medium text-white flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-teal-300" /> Set date · {count}{" "}
            selected
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setMode("absolute")}
              className={`flex-1 px-2 py-1.5 rounded border ${
                mode === "absolute"
                  ? "bg-teal-600/30 border-teal-500 text-teal-100"
                  : "bg-gray-800 border-gray-700 text-gray-400"
              }`}
            >
              Set exact date
            </button>
            <button
              onClick={() => setMode("shift")}
              className={`flex-1 px-2 py-1.5 rounded border ${
                mode === "shift"
                  ? "bg-teal-600/30 border-teal-500 text-teal-100"
                  : "bg-gray-800 border-gray-700 text-gray-400"
              }`}
            >
              Shift by offset
            </button>
          </div>

          {mode === "absolute" ? (
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">
                All selected items will get this date
              </label>
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400"
              />
              <p className="text-[11px] text-gray-500">
                Files on disk will be moved into the correct yyyy/mm folder.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">
                Shift each item&rsquo;s date by:
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    value={shiftDays}
                    onChange={(e) => setShiftDays(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400"
                  />
                  <div className="text-[11px] text-gray-500 mt-0.5">days</div>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={shiftHours}
                    onChange={(e) => setShiftHours(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400"
                  />
                  <div className="text-[11px] text-gray-500 mt-0.5">hours</div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500">
                Use negative numbers to shift backwards.
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-300">{error}</p>}
          {done && <p className="text-xs text-teal-300">{done}</p>}
        </div>
        <div className="p-3 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded-md text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-3 py-1.5 rounded-md text-sm bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateAlbumModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (album: AlbumWithCounts) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-sm">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-medium text-white">New album</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <label className="block text-sm text-gray-300">
            Album name
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-violet-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </label>
        </div>
        <div className="p-3 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="px-3 py-1.5 rounded-md text-sm bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gallery/albums", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const album = await res.json();
        onCreated({
          ...album,
          item_count: 0,
          cover_storage_key: null,
          cover_kind: null,
        });
      }
    } finally {
      setBusy(false);
    }
  }
}
