"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFullscreen } from "@/lib/useFullscreen";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Grid3x3,
  Film,
  Search,
  ExternalLink,
  Tag as TagIcon,
  Heart,
  Eye,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  Share2,
  Send,
  X,
  Trash2,
  Check,
  CheckSquare,
  Copy,
  ArrowLeft,
  Compass,
  Folder,
  Pencil,
  Shuffle,
  Users,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { encodeSlugForUrl } from "@/lib/clipSlugs";
import { mediaToken } from "@/lib/mediaToken";
import ProfilesAdminButtons from "./ProfilesAdminButtons";

export interface ProfileCard {
  profile: string;
  count: number;
  lastMtime: number;
  sampleSlug: string | null;
  sampleHasPoster: boolean;
  samplePosterMtime: number;
  sampleVideoMtime: number;
}

export interface ClipSummary {
  slug: string;
  /** Profile folder name if the clip lives in `<root>/<profile>/`, otherwise null. */
  profile: string | null;
  /** Top-level category folder for shorts18 (`uncategorized | straight | gay | lesbian | trans`). */
  category?: string | null;
  /** Which backend serves this clip. Defaults to the page-level `library` prop when omitted, so existing single-source pages keep working unchanged. */
  source?: "clips" | "shorts18" | "tiktok";
  videoExt: string;
  videoMtime: number;
  hasPoster: boolean;
  posterMtime: number;
  /** "ready" = `.web.mp4` is being served; "pending" = original is being served, transcoder still queued; "failed" = both ffmpeg and VLC gave up. */
  transcodeStatus?: "ready" | "pending" | "failed";
  title: string;
  description: string | null;
  uploader: string | null;
  tags: string[];
  url: string | null;
  likes: number;
  views: number;
  comments: number;
}

// Build per-endpoint API URLs for a clip. Clips/shorts18 follow the
// `/api/<lib>/<slug>/<endpoint>` convention; TikTok routes differ:
// posters/videos live at `/api/tiktok/{poster,video}/<videoId>` while
// like/view/comments live at `/api/tiktok/<videoId>/<endpoint>`. The
// slug for TikTok items is `<username>/<videoId>` so we split off the
// videoId here.
function apiUrlFor(
  clip: ClipSummary,
  libraryDefault: "clips" | "shorts18",
  endpoint: "video" | "poster" | "like" | "view" | "comments" | "category" | "title",
): string {
  const source = clip.source ?? libraryDefault;
  if (source === "tiktok") {
    const videoId = clip.slug.includes("/") ? clip.slug.split("/").pop()! : clip.slug;
    if (endpoint === "video") return `/api/tiktok/video/${encodeURIComponent(videoId)}`;
    if (endpoint === "poster") return `/api/tiktok/poster/${encodeURIComponent(videoId)}`;
    return `/api/tiktok/${encodeURIComponent(videoId)}/${endpoint}`;
  }
  return `/api/${source}/${urlSlug(clip.slug)}/${endpoint}`;
}

// Playback/render URL for <video>/<img> tags: mtime cache-buster + media
// token (the routes require auth and plain tags can't set headers). Share
// URLs stored elsewhere must stay token-free.
function mediaSrcFor(
  clip: ClipSummary,
  libraryDefault: "clips" | "shorts18",
  endpoint: "video" | "poster",
  mtime: number,
): string {
  return `${apiUrlFor(clip, libraryDefault, endpoint)}?v=${Math.floor(mtime)}&t=${encodeURIComponent(mediaToken())}`;
}

function urlSlug(slug: string): string {
  return encodeURIComponent(encodeSlugForUrl(slug));
}

interface CommentItem {
  id: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${
      typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : ""
    }`,
  };
}

function compactNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

type ViewMode = "feed" | "grid" | "profiles";

const ADULTS_CATEGORIES = ["straight", "gay", "lesbian", "trans"] as const;
type AdultsCategory = (typeof ADULTS_CATEGORIES)[number];
type AdultsFilter = AdultsCategory | "uncategorized";
const ADULTS_FILTER_OPTIONS: AdultsFilter[] = ["uncategorized", ...ADULTS_CATEGORIES];

function seenStorageKey(library: "clips" | "shorts18") {
  return `${library}_seen`;
}

function loadSeenSet(library: "clips" | "shorts18"): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(seenStorageKey(library));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistSeenSet(library: "clips" | "shorts18", set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(seenStorageKey(library), JSON.stringify(Array.from(set)));
  } catch {
    /* quota exhausted — drop silently */
  }
}

// Mulberry32 deterministic PRNG so a given shuffleSeed produces a stable order.
function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface ClipState {
  likes: number;
  views: number;
  liked: boolean;
  comments: number;
}

export default function ClipsClient({
  clips,
  library = "clips",
  profile,
  profiles = [],
}: {
  clips: ClipSummary[];
  library?: "clips" | "shorts18";
  /** When set, the page is filtered to a single profile; render a header with a back link. */
  profile?: string;
  /** Profile cards for the "Profiles" tab. Only relevant on the index page. */
  profiles?: ProfileCard[];
}) {
  const [view, setView] = useState<ViewMode>("feed");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AdultsFilter | null>(null);
  // Optimistic local override of category for items the user just moved.
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);
  const [seenSlugs, setSeenSlugs] = useState<Set<string>>(() => loadSeenSet(library));
  const [state, setState] = useState<Record<string, ClipState>>(() => {
    const init: Record<string, ClipState> = {};
    for (const c of clips) {
      init[c.slug] = { likes: c.likes, views: c.views, comments: c.comments, liked: false };
    }
    return init;
  });
  const [commentsOpenSlug, setCommentsOpenSlug] = useState<string | null>(null);

  // Read ?view= and ?id= once at mount; keep them synced via replaceState.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    if (v === "grid" || v === "profiles") setView(v);
    const id = params.get("id");
    if (id) setActiveSlug(id);
  }, []);

  // Fetch which clips the current user has already liked. When the feed is
  // a merged Shorties view (clips + tiktok), fetch from every source the
  // current list actually contains so we don't miss liked items from one
  // backend.
  useEffect(() => {
    const sources = new Set<string>([library]);
    for (const c of clips) if (c.source) sources.add(c.source);
    Promise.all(
      Array.from(sources).map((src) =>
        fetch(`/api/${src}/me/likes`, { headers: authHeaders() })
          .then((r) => (r.ok ? r.json() : []))
          .then((data) => (Array.isArray(data) ? (data as string[]) : []))
          .catch(() => [] as string[]),
      ),
    ).then((groups) => {
      const liked = new Set<string>();
      for (const g of groups) for (const s of g) liked.add(s);
      setState((prev) => {
        const next = { ...prev };
        for (const slug of liked) {
          if (next[slug]) next[slug] = { ...next[slug], liked: true };
        }
        // For tiktok items the API returns bare videoIds while our slug is
        // `<username>/<videoId>` — also match by trailing videoId.
        for (const c of clips) {
          if (c.source === "tiktok") {
            const id = c.slug.split("/").pop()!;
            if (liked.has(id) && next[c.slug]) next[c.slug] = { ...next[c.slug], liked: true };
          }
        }
        return next;
      });
    });
  }, [library, clips]);

  // Per-slug lookup so source-aware URL helpers can route per-clip in the
  // merged Shorties feed (clips + tiktok mixed) without touching call sites.
  const clipsBySlug = useMemo(() => {
    const map = new Map<string, ClipSummary>();
    for (const c of clips) map.set(c.slug, c);
    return map;
  }, [clips]);

  const apiUrl = useCallback(
    (slug: string, endpoint: "video" | "poster" | "like" | "view" | "comments" | "category" | "title") => {
      const c = clipsBySlug.get(slug);
      if (!c) return `/api/${library}/${urlSlug(slug)}/${endpoint}`;
      return apiUrlFor(c, library, endpoint);
    },
    [clipsBySlug, library],
  );

  const toggleLike = useCallback(async (slug: string) => {
    const cur = (() => {
      let c: ClipState | undefined;
      setState((prev) => {
        c = prev[slug];
        if (!c) return prev;
        const liked = !c.liked;
        return {
          ...prev,
          [slug]: {
            ...c,
            liked,
            likes: c.likes + (liked ? 1 : -1),
          },
        };
      });
      return c;
    })();
    if (!cur) return;
    const liked = !cur.liked;
    try {
      const res = await fetch(apiUrl(slug, "like"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ liked }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { liked: boolean; likes: number; views: number };
      setState((prev) => {
        const c = prev[slug];
        if (!c) return prev;
        return {
          ...prev,
          [slug]: { ...c, likes: data.likes, views: data.views, liked: data.liked },
        };
      });
    } catch {
      // Revert on failure
      setState((prev) => {
        const c = prev[slug];
        if (!c) return prev;
        return {
          ...prev,
          [slug]: {
            ...c,
            liked: cur!.liked,
            likes: cur!.likes,
          },
        };
      });
    }
  }, [library]);

  // When recordView fires, also remember locally so Shuffle's "unseen first"
  // matches what the user has actually scrolled past.
  const markLocallySeen = useCallback(
    (slug: string) => {
      setSeenSlugs((prev) => {
        if (prev.has(slug)) return prev;
        const next = new Set(prev);
        next.add(slug);
        persistSeenSet(library, next);
        return next;
      });
    },
    [library],
  );

  const recordView = useCallback(async (slug: string) => {
    markLocallySeen(slug);
    try {
      const res = await fetch(apiUrl(slug, "view"), {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { likes: number; views: number };
      setState((prev) => {
        const c = prev[slug];
        if (!c) return prev;
        if (c.views >= data.views) return prev;
        return { ...prev, [slug]: { ...c, views: data.views } };
      });
    } catch {}
  }, [apiUrl, markLocallySeen]);

  const setClipCategory = useCallback(
    async (slug: string, category: string) => {
      const res = await fetch(apiUrl(slug, "category"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      if (!res.ok) throw new Error(`Move failed (${res.status})`);
      setCategoryOverrides((prev) => ({ ...prev, [slug]: category }));
    },
    [apiUrl],
  );

  // Local-only title overrides for in-place editing; clips array is server-
  // rendered so we apply the new title client-side until the page reloads.
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>({});

  const setClipTitle = useCallback(
    async (slug: string, title: string) => {
      const res = await fetch(apiUrl(slug, "title"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Save failed (${res.status})`);
      }
      setTitleOverrides((prev) => ({ ...prev, [slug]: title }));
    },
    [apiUrl],
  );

  const updateCommentCount = useCallback((slug: string, count: number) => {
    setState((prev) => {
      const c = prev[slug];
      if (!c) return prev;
      return { ...prev, [slug]: { ...c, comments: count } };
    });
  }, []);

  const share = useCallback(async (slug: string, title: string) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/videos/clips?id=${encodeURIComponent(slug)}`;
    const data = { title, url };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch {
        // user cancelled or unsupported – fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (next === "feed") sp.delete("view");
    else sp.set("view", next);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  function pickFromGrid(slug: string) {
    setActiveSlug(slug);
    changeView("feed");
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      sp.set("id", slug);
      sp.delete("view");
      window.history.replaceState(null, "", `?${sp.toString()}`);
    }
  }

  // If there's truly nothing to show, render the empty state. When viewing the
  // index and there are profile folders but no top-level clips, fall through to
  // the layout so the Profiles tab is still reachable.
  if (clips.length === 0 && (profile || profiles.length === 0)) {
    return <EmptyState library={library} profile={profile} />;
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } = useFullscreen(rootRef);
  const showTabs = !profile;
  const displayClips = useMemo(() => {
    // Apply local category + title overrides so a just-edited clip reflects
    // the new state without waiting for a page reload.
    let arr = clips.map((c) => {
      let next = c;
      if (categoryOverrides[c.slug]) next = { ...next, category: categoryOverrides[c.slug] };
      if (titleOverrides[c.slug]) next = { ...next, title: titleOverrides[c.slug] };
      return next;
    });
    if (categoryFilter) {
      arr = arr.filter((c) => (c.category ?? "uncategorized") === categoryFilter);
    }
    if (shuffleSeed !== null) {
      const rng = makeRng(shuffleSeed);
      const unseen: ClipSummary[] = [];
      const seen: ClipSummary[] = [];
      for (const c of arr) (seenSlugs.has(c.slug) ? seen : unseen).push(c);
      shuffleInPlace(unseen, rng);
      shuffleInPlace(seen, rng);
      arr = [...unseen, ...seen];
    }
    return arr;
  }, [clips, categoryFilter, shuffleSeed, seenSlugs, categoryOverrides, titleOverrides]);

  const showAdultsToolbar = library === "shorts18" && view === "feed" && !profile;

  const effectiveView: ViewMode =
    view === "profiles" && (!showTabs || profiles.length === 0)
      ? "feed"
      : view === "feed" && clips.length === 0 && showTabs && profiles.length > 0
      ? "profiles"
      : view;

  return (
    <div ref={rootRef} className="absolute inset-0 flex flex-col bg-black">
      <div className="flex-shrink-0 z-30 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {profile && (
            <a
              href={`/${library}`}
              aria-label="Back to all clips"
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center"
            >
              <ArrowLeft size={14} />
            </a>
          )}
          <div className="flex items-center gap-1 bg-black/50 rounded-full p-0.5 backdrop-blur-sm">
            {showTabs ? (
              <>
                <ToggleBtn active={effectiveView === "feed"} onClick={() => changeView("feed")}>
                  <Film size={14} /> Videos
                </ToggleBtn>
                <ToggleBtn active={effectiveView === "grid"} onClick={() => changeView("grid")}>
                  <Compass size={14} /> Explore
                </ToggleBtn>
                <ToggleBtn active={effectiveView === "profiles"} onClick={() => changeView("profiles")}>
                  <Users size={14} /> Profiles
                  {profiles.length > 0 && (
                    <span className="opacity-70">({profiles.length})</span>
                  )}
                </ToggleBtn>
              </>
            ) : (
              <>
                <ToggleBtn active={effectiveView === "feed"} onClick={() => changeView("feed")}>
                  <Film size={14} /> Feed
                </ToggleBtn>
                <ToggleBtn active={effectiveView === "grid"} onClick={() => changeView("grid")}>
                  <Grid3x3 size={14} /> Grid
                </ToggleBtn>
              </>
            )}
          </div>
          {profile && (
            <span className="text-white/80 text-xs font-semibold bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 truncate max-w-[40vw]">
              @{profile}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          {showAdultsToolbar && (
            <button
              type="button"
              onClick={() => setShuffleSeed(shuffleSeed === null ? Date.now() & 0x7fffffff : null)}
              aria-label={shuffleSeed === null ? "Shuffle (unseen first)" : "Disable shuffle"}
              title={shuffleSeed === null ? "Shuffle (unseen first)" : "Disable shuffle"}
              className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center ${
                shuffleSeed !== null
                  ? "bg-pink-500/30 text-pink-200 hover:bg-pink-500/40"
                  : "bg-black/50 text-white hover:bg-black/70"
              }`}
            >
              <Shuffle size={14} />
            </button>
          )}
          {fullscreenSupported && effectiveView === "feed" && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          <p className="text-xs text-white/70">
            {effectiveView === "profiles"
              ? `${profiles.length} profile${profiles.length === 1 ? "" : "s"}`
              : `${displayClips.length} clip${displayClips.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {showAdultsToolbar && (
        <div className="absolute top-14 left-0 right-0 z-30 px-4 py-1.5 flex items-center justify-center gap-1 pointer-events-none overflow-x-auto">
          <div className="flex items-center gap-1 bg-black/50 rounded-full p-0.5 backdrop-blur-sm pointer-events-auto whitespace-nowrap">
            <CategoryChip
              active={categoryFilter === null}
              onClick={() => setCategoryFilter(null)}
              label="All"
            />
            {ADULTS_FILTER_OPTIONS.map((cat) => (
              <CategoryChip
                key={cat}
                active={categoryFilter === cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                label={cat[0].toUpperCase() + cat.slice(1)}
              />
            ))}
          </div>
        </div>
      )}

      {effectiveView === "feed" ? (
        <FeedView
          clips={displayClips}
          library={library}
          initialSlug={activeSlug}
          state={state}
          onToggleLike={toggleLike}
          onView={recordView}
          onOpenComments={(slug) => setCommentsOpenSlug(slug)}
          onShare={share}
          onSetCategory={library === "shorts18" ? setClipCategory : undefined}
          onSetTitle={setClipTitle}
        />
      ) : effectiveView === "grid" ? (
        <GridView clips={displayClips} library={library} onPick={pickFromGrid} state={state} />
      ) : (
        <ProfilesView profiles={profiles} library={library} />
      )}

      {commentsOpenSlug && (() => {
        const clip = clipsBySlug.get(commentsOpenSlug);
        const baseUrl = clip ? apiUrlFor(clip, library, "comments") : `/api/${library}/${urlSlug(commentsOpenSlug)}/comments`;
        return (
          <CommentsSheet
            slug={commentsOpenSlug}
            commentsUrl={baseUrl}
            title={clip?.title ?? commentsOpenSlug}
            onClose={() => setCommentsOpenSlug(null)}
            onCountChange={(n) => updateCommentCount(commentsOpenSlug, n)}
          />
        );
      })()}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? "bg-white text-black" : "text-white/80 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
        active ? "bg-pink-500 text-white" : "text-white/80 hover:text-white hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({
  library,
  profile,
}: {
  library: "clips" | "shorts18";
  profile?: string;
}) {
  const baseFolder =
    library === "shorts18"
      ? "/mnt/4tb/elite/shorts18"
      : "/mnt/4tb/elite/shortvideos";
  const folder = profile ? `${baseFolder}/${profile}` : baseFolder;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-dark-card border border-dark-border flex items-center justify-center text-gray-400">
        <Film size={28} />
      </div>
      <p className="text-sm font-medium text-gray-300">
        {profile ? `No clips for @${profile} yet` : "No clips yet"}
      </p>
      <p className="text-xs">
        Drop video files (mp4, webm, mov) in{" "}
        <code className="bg-dark-card2 px-1.5 py-0.5 rounded text-gray-400 text-[11px]">
          {folder}
        </code>{" "}
        to get started
      </p>
      {profile && (
        <a
          href={`/${library}`}
          className="text-xs text-blue-400 hover:text-blue-300 underline mt-2"
        >
          Back to all clips
        </a>
      )}
    </div>
  );
}

/* --------------------------- Feed ---------------------------- */

function FeedView({
  clips,
  library,
  initialSlug,
  state,
  onToggleLike,
  onView,
  onOpenComments,
  onShare,
  onSetCategory,
  onSetTitle,
}: {
  clips: ClipSummary[];
  library: "clips" | "shorts18";
  initialSlug: string | null;
  state: Record<string, ClipState>;
  onToggleLike: (slug: string) => void;
  onView: (slug: string) => void;
  onOpenComments: (slug: string) => void;
  onShare: (slug: string, title: string) => void;
  onSetCategory?: (slug: string, category: string) => Promise<void>;
  onSetTitle?: (slug: string, title: string) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // Scroll to initial slug on mount
  useEffect(() => {
    if (!initialSlug) return;
    const idx = clips.findIndex((c) => c.slug === initialSlug);
    if (idx < 0) return;
    const el = containerRef.current?.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "instant", block: "start" });
    setActiveIndex(idx);
  }, [initialSlug, clips]);

  // Warm the byte cache for the clip two ahead so the next swipe feels
  // instant. <link rel="prefetch"> downloads bytes without allocating a
  // media decoder, so it sidesteps the mobile decoder limit.
  useEffect(() => {
    const next = clips[activeIndex + 2];
    if (!next) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "video";
    link.href = mediaSrcFor(next, library, "video", next.videoMtime);
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [activeIndex, clips, library]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-scroll snap-y snap-mandatory"
      style={{ scrollbarWidth: "none" }}
    >
      <style>{`.feed-scroll::-webkit-scrollbar { display: none; }`}</style>
      {clips.map((c, i) => (
        <FeedItem
          key={c.slug}
          clip={c}
          library={library}
          index={i}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          state={
            state[c.slug] ?? {
              likes: c.likes,
              views: c.views,
              comments: c.comments,
              liked: false,
            }
          }
          onToggleLike={() => onToggleLike(c.slug)}
          onView={() => onView(c.slug)}
          onOpenComments={() => onOpenComments(c.slug)}
          onShare={() => onShare(c.slug, c.title)}
          onSetCategory={
            onSetCategory ? (category) => onSetCategory(c.slug, category) : undefined
          }
          onSetTitle={onSetTitle ? (title) => onSetTitle(c.slug, title) : undefined}
        />
      ))}
    </div>
  );
}

function FeedItem({
  clip,
  library,
  index,
  activeIndex,
  onActiveChange,
  muted,
  onToggleMute,
  state,
  onToggleLike,
  onView,
  onOpenComments,
  onShare,
  onSetCategory,
  onSetTitle,
}: {
  clip: ClipSummary;
  library: "clips" | "shorts18";
  index: number;
  activeIndex: number;
  onActiveChange: (i: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  state: ClipState;
  onToggleLike: () => void;
  onView: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  onSetCategory?: (category: string) => Promise<void>;
  onSetTitle?: (title: string) => Promise<void>;
}) {
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [catBusy, setCatBusy] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(clip.title);
  const [titleBusy, setTitleBusy] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const viewRecordedRef = useRef(false);
  const isActive = activeIndex === index;

  async function copySlug() {
    try {
      await navigator.clipboard.writeText(clip.slug);
      setCopiedSlug(true);
      setTimeout(() => setCopiedSlug(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. http context) — fall back silently
    }
  }

  // Record a view after this clip has been the active one for ~3 seconds.
  useEffect(() => {
    if (!isActive || viewRecordedRef.current) return;
    const t = setTimeout(() => {
      viewRecordedRef.current = true;
      onView();
    }, 3000);
    return () => clearTimeout(t);
  }, [isActive, onView]);

  function handleLikeClick() {
    if (!state.liked) {
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 700);
    }
    onToggleLike();
  }

  // Use IntersectionObserver to track which clip is currently visible
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            onActiveChange(index);
          }
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onActiveChange]);

  const videoSrc = mediaSrcFor(clip, library, "video", clip.videoMtime);
  const poster = clip.hasPoster
    ? mediaSrcFor(clip, library, "poster", clip.posterMtime)
    : undefined;
  const distance = Math.abs(activeIndex - index);
  const inWindow = distance <= 1;

  // Attach src only for clips inside the window; explicitly clear and
  // call load() when leaving so the media decoder is released. Mobile
  // browsers cap concurrent decoders (~4 on Android Chrome); a plain
  // unmount can leave the decoder allocated for hundreds of ms, which
  // is enough to hit the limit during fast scrolling and turn later
  // clips black.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inWindow) {
      if (v.getAttribute("src") !== videoSrc) {
        v.src = videoSrc;
        v.load();
      }
    } else if (v.hasAttribute("src")) {
      v.pause();
      v.removeAttribute("src");
      v.load();
    }
  }, [inWindow, videoSrc]);

  // Play/pause based on active state
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !inWindow) return;
    if (isActive && !paused) {
      v.play().catch(() => {
        // Autoplay rejected; will require user interaction
      });
    } else {
      v.pause();
      if (!isActive) v.currentTime = 0;
    }
  }, [isActive, paused, inWindow]);

  function togglePlay() {
    setPaused((p) => {
      const next = !p;
      setShowOverlay(true);
      setTimeout(() => setShowOverlay(false), 600);
      return next;
    });
  }

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full snap-start snap-always overflow-hidden bg-black flex items-center justify-center"
      style={{ height: "100%" }}
    >
      <video
        ref={videoRef}
        poster={poster}
        muted={muted}
        loop
        playsInline
        preload={isActive ? "auto" : "metadata"}
        onClick={togglePlay}
        className="w-full h-full object-contain"
      />
      {!poster && !inWindow && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/20">
          <Film size={48} />
        </div>
      )}

      {/* Tap-to-play feedback */}
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 rounded-full p-5 backdrop-blur-sm">
            {paused ? <Pause size={36} className="text-white" /> : <Play size={36} className="text-white" />}
          </div>
        </div>
      )}

      {/* Bottom gradient + title/description */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pb-6 pointer-events-none">
        <div className="max-w-2xl">
          {editingTitle && onSetTitle ? (
            <div className="flex items-start gap-2 pointer-events-auto">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value.slice(0, 200))}
                autoFocus
                onKeyDown={async (e) => {
                  if (e.key === "Escape") {
                    setEditingTitle(false);
                    setTitleDraft(clip.title);
                    setTitleError(null);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const t = titleDraft.trim();
                    if (!t || titleBusy) return;
                    setTitleBusy(true);
                    setTitleError(null);
                    try {
                      await onSetTitle(t);
                      setEditingTitle(false);
                    } catch (err) {
                      setTitleError(err instanceof Error ? err.message : "Save failed");
                    } finally {
                      setTitleBusy(false);
                    }
                  }
                }}
                className="flex-1 min-w-0 bg-black/60 backdrop-blur-sm text-white text-base font-semibold rounded-md px-2 py-1 outline-none border border-white/30 focus:border-pink-400"
              />
              <button
                type="button"
                onClick={() => {
                  setEditingTitle(false);
                  setTitleDraft(clip.title);
                  setTitleError(null);
                }}
                className="flex-shrink-0 w-7 h-7 -mt-0.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white/80 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Cancel"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <h2
                className="text-white text-base font-semibold drop-shadow truncate select-text pointer-events-auto cursor-text flex-1 min-w-0"
                title={clip.slug}
              >
                {clip.title}
              </h2>
              {onSetTitle && (
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(clip.title);
                    setEditingTitle(true);
                  }}
                  aria-label="Edit title"
                  className="flex-shrink-0 w-7 h-7 -mt-0.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white/80 hover:text-white flex items-center justify-center pointer-events-auto transition-colors"
                >
                  <Pencil size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={copySlug}
                aria-label="Copy filename"
                className="flex-shrink-0 w-7 h-7 -mt-0.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white/80 hover:text-white flex items-center justify-center pointer-events-auto transition-colors"
              >
                {copiedSlug ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
          )}
          {titleError && (
            <p className="text-[11px] text-red-300 mt-1">{titleError}</p>
          )}
          {clip.uploader && (
            <p className="text-white/70 text-xs mt-0.5 select-text pointer-events-auto cursor-text">
              {clip.profile ? (
                <a
                  href={`/${library}/${encodeURIComponent(clip.profile)}`}
                  className="hover:text-white hover:underline"
                >
                  @{clip.uploader}
                </a>
              ) : (
                <>@{clip.uploader}</>
              )}
            </p>
          )}
          {clip.description && (
            <p className="text-white/85 text-sm mt-1 line-clamp-3 whitespace-pre-line drop-shadow select-text pointer-events-auto cursor-text">
              {clip.description}
            </p>
          )}
          {clip.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 pointer-events-auto">
              {clip.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-[11px] rounded-full px-2 py-0.5"
                >
                  <TagIcon size={9} /> {t}
                </span>
              ))}
            </div>
          )}
          {clip.url && (
            <a
              href={clip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-blue-300 hover:text-blue-200 pointer-events-auto"
            >
              <ExternalLink size={11} /> Source
            </a>
          )}
        </div>
      </div>

      {/* Right-side controls */}
      <div className="absolute right-3 bottom-24 flex flex-col gap-4 z-10">
        <button
          type="button"
          onClick={handleLikeClick}
          aria-label={state.liked ? "Unlike" : "Like"}
          className="flex flex-col items-center gap-1 group"
        >
          <span
            className={`w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center transition-all ${
              state.liked
                ? "bg-rose-500/90 text-white scale-110"
                : "bg-black/50 hover:bg-black/70 text-white"
            }`}
          >
            <Heart
              size={22}
              className={state.liked ? "fill-current" : ""}
            />
          </span>
          <span className="text-white text-[11px] font-semibold drop-shadow tabular-nums">
            {compactNumber(state.likes)}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenComments}
          aria-label="Comments"
          className="flex flex-col items-center gap-1 group"
        >
          <span className="w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center transition-colors">
            <MessageCircle size={22} />
          </span>
          <span className="text-white text-[11px] font-semibold drop-shadow tabular-nums">
            {compactNumber(state.comments)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onShare();
            setShared(true);
            setTimeout(() => setShared(false), 1500);
          }}
          aria-label="Share"
          className="flex flex-col items-center gap-1 group"
        >
          <span className="w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center transition-colors">
            {shared ? <Check size={22} className="text-emerald-400" /> : <Share2 size={22} />}
          </span>
          <span className="text-white text-[11px] font-semibold drop-shadow">
            {shared ? "Copied" : "Share"}
          </span>
        </button>

        <div className="flex flex-col items-center gap-1">
          <span className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center">
            <Eye size={22} />
          </span>
          <span className="text-white text-[11px] font-semibold drop-shadow tabular-nums">
            {compactNumber(state.views)}
          </span>
        </div>

        {onSetCategory && library === "shorts18" && (
          <div className="relative flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setCatMenuOpen((v) => !v)}
              aria-label="Set category"
              className="w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
              disabled={catBusy}
            >
              {catBusy ? <Loader2 size={20} className="animate-spin" /> : <Folder size={20} />}
            </button>
            <span className="text-white text-[11px] font-semibold drop-shadow truncate max-w-[64px] text-center">
              {(clip.category ?? "uncategorized").slice(0, 8)}
            </span>
            {catMenuOpen && (
              <div className="absolute right-14 top-0 bg-dark-card border border-dark-border rounded-lg shadow-xl py-1 min-w-[140px] pointer-events-auto z-40">
                {ADULTS_FILTER_OPTIONS.map((cat) => {
                  const isCurrent = (clip.category ?? "uncategorized") === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={async () => {
                        if (isCurrent || catBusy) {
                          setCatMenuOpen(false);
                          return;
                        }
                        setCatBusy(true);
                        try {
                          await onSetCategory(cat);
                        } finally {
                          setCatBusy(false);
                          setCatMenuOpen(false);
                        }
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-dark-card2 ${
                        isCurrent ? "text-pink-300 font-semibold" : "text-gray-200"
                      }`}
                    >
                      {cat[0].toUpperCase() + cat.slice(1)}
                      {isCurrent && " ✓"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center transition-colors mx-auto"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Burst heart animation when liking */}
      {showHeartBurst && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart
            size={120}
            className="text-rose-500 fill-rose-500 drop-shadow-2xl animate-ping"
            style={{ animationDuration: "700ms", animationIterationCount: 1 }}
          />
        </div>
      )}

      {/* Transcode-status badge: tells the viewer whether the player is
          serving the optimised .web.mp4 or still chewing on the raw original. */}
      {clip.transcodeStatus === "pending" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 bg-amber-500/85 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm shadow">
            <Loader2 size={12} className="animate-spin" />
            Optimising for streaming…
          </span>
        </div>
      )}
      {clip.transcodeStatus === "failed" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 bg-red-500/85 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm shadow">
            <X size={12} />
            Original (may not play)
          </span>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Grid ---------------------------- */

function GridView({
  clips,
  library,
  onPick,
  state,
}: {
  clips: ClipSummary[];
  library: "clips" | "shorts18";
  onPick: (slug: string) => void;
  state: Record<string, ClipState>;
}) {
  const [query, setQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const canBulk = library === "shorts18";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.uploader ?? "").toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [clips, query]);

  function toggleSelect(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
    setCatMenuOpen(false);
  }

  function selectAll() {
    setSelected(new Set(filtered.map((c) => c.slug)));
  }

  async function bulkMove(category: string) {
    if (selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const res = await fetch(`/api/${library}/bulk-category`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ category, slugs: Array.from(selected) }),
      });
      if (res.ok) {
        const data = await res.json();
        setBulkMsg(`Moved ${data.moved ?? 0} → ${category}`);
        setTimeout(() => window.location.reload(), 500);
      } else {
        setBulkMsg("Move failed");
      }
    } finally {
      setBulkBusy(false);
      setCatMenuOpen(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg pt-16 px-4 md:px-6 pb-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clips..."
              className="w-full bg-dark-input border border-dark-border rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          {canBulk && (
            <button
              type="button"
              onClick={() => {
                if (selectMode) exitSelect();
                else setSelectMode(true);
              }}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                selectMode
                  ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                  : "bg-dark-card border-dark-border text-gray-300 hover:bg-dark-card2"
              }`}
            >
              <CheckSquare size={14} />
              {selectMode ? "Cancel" : "Select"}
            </button>
          )}
        </div>

        {selectMode && (
          <div className="sticky top-0 z-20 bg-dark-bg/90 backdrop-blur-sm border border-dark-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white font-medium">{selected.size} selected</span>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-dark-card2"
            >
              Select all ({filtered.length})
            </button>
            <div className="flex-1" />
            <div className="relative">
              <button
                type="button"
                onClick={() => setCatMenuOpen((v) => !v)}
                disabled={selected.size === 0 || bulkBusy}
                className="px-3 py-1.5 text-xs rounded-lg bg-pink-500/20 text-pink-200 hover:bg-pink-500/30 border border-pink-500/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Folder size={12} />}
                Move to category
              </button>
              {catMenuOpen && (
                <div className="absolute right-0 mt-1 bg-dark-card border border-dark-border rounded-lg shadow-xl py-1 min-w-[150px] z-30">
                  {ADULTS_FILTER_OPTIONS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => bulkMove(cat)}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-dark-card2"
                    >
                      {cat[0].toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={exitSelect}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-dark-card2"
            >
              Done
            </button>
            {bulkMsg && (
              <span className="text-xs text-emerald-300 w-full">{bulkMsg}</span>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">Nothing matches</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((c) => (
              <GridCard
                key={c.slug}
                clip={c}
                library={library}
                onPick={() => {
                  if (selectMode) toggleSelect(c.slug);
                  else onPick(c.slug);
                }}
                onLongPress={
                  canBulk
                    ? () => {
                        setSelectMode(true);
                        toggleSelect(c.slug);
                      }
                    : undefined
                }
                selected={selected.has(c.slug)}
                selectMode={selectMode}
                state={
                  state[c.slug] ?? {
                    likes: c.likes,
                    views: c.views,
                    comments: c.comments,
                    liked: false,
                  }
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GridCard({
  clip,
  library,
  onPick,
  onLongPress,
  selected,
  selectMode,
  state,
}: {
  clip: ClipSummary;
  library: "clips" | "shorts18";
  onPick: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  selectMode?: boolean;
  state: ClipState;
}) {
  const poster = clip.hasPoster
    ? mediaSrcFor(clip, library, "poster", clip.posterMtime)
    : null;
  const video = mediaSrcFor(clip, library, "video", clip.videoMtime);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  function clearTimer() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startTimer() {
    if (!onLongPress) return;
    longPressFired.current = false;
    clearTimer();
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onLongPress?.();
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate(40); } catch { /* ignore */ }
      }
    }, 450);
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (longPressFired.current) {
          longPressFired.current = false;
          return;
        }
        onPick();
      }}
      onTouchStart={startTimer}
      onTouchEnd={clearTimer}
      onTouchMove={clearTimer}
      onTouchCancel={clearTimer}
      onMouseDown={startTimer}
      onMouseUp={clearTimer}
      onMouseLeave={clearTimer}
      onContextMenu={(e) => {
        if (onLongPress) {
          e.preventDefault();
          longPressFired.current = true;
          onLongPress();
        }
      }}
      className={`group bg-dark-card hover:bg-dark-card2 border rounded-xl overflow-hidden text-left transition-colors flex flex-col ${
        selected ? "border-pink-500 ring-2 ring-pink-500/40" : "border-dark-border"
      }`}
    >
      <div className="relative aspect-[9/16] bg-black flex items-center justify-center">
        {poster ? (
          <img src={poster} alt={clip.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <video
            src={video + "#t=0.1"}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        )}
        {selectMode && (
          <span
            className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              selected
                ? "bg-pink-500 border-pink-500 text-white"
                : "bg-black/40 border-white/60 text-transparent"
            }`}
          >
            <Check size={14} />
          </span>
        )}
        {!selectMode && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <Play size={20} className="text-white" />
            </div>
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-white text-[10px] font-semibold drop-shadow">
          <span className="inline-flex items-center gap-0.5 bg-black/50 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <Eye size={10} /> {compactNumber(state.views)}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 backdrop-blur-sm rounded-full px-1.5 py-0.5 ${
              state.liked ? "bg-rose-500/80" : "bg-black/50"
            }`}
          >
            <Heart size={10} className={state.liked ? "fill-current" : ""} />{" "}
            {compactNumber(state.likes)}
          </span>
        </div>
        {clip.transcodeStatus === "pending" && (
          <span
            className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 bg-amber-500/85 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-sm"
            title="Transcoding — may be slow to start"
          >
            <Loader2 size={9} className="animate-spin" /> Transcoding
          </span>
        )}
        {clip.transcodeStatus === "failed" && (
          <span
            className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 bg-red-500/85 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-sm"
            title="Transcode failed — the original may not play in browsers"
          >
            <X size={9} /> Failed
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-sm font-medium text-white truncate">{clip.title}</p>
        {clip.uploader && (
          <p className="text-[11px] text-gray-500 truncate">@{clip.uploader}</p>
        )}
      </div>
    </button>
  );
}

/* --------------------------- Profiles ---------------------------- */

function ProfilesView({
  profiles,
  library,
}: {
  profiles: ProfileCard[];
  library: "clips" | "shorts18";
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => p.profile.toLowerCase().includes(q));
  }, [profiles, query]);

  const folder =
    library === "shorts18"
      ? "/mnt/4tb/elite/shorts18"
      : "/mnt/4tb/elite/shortvideos";

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg pt-16 px-4 md:px-6 pb-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {library === "clips" && <ProfilesAdminButtons />}
        {profiles.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-dark-card border border-dark-border flex items-center justify-center text-gray-400">
              <Users size={28} />
            </div>
            <p className="text-sm font-medium text-gray-300">No profiles yet</p>
            <p className="text-xs text-gray-500">
              {library === "clips" ? (
                <>Use the buttons above, or create a folder under{" "}</>
              ) : (
                <>Create a folder under{" "}</>
              )}
              <code className="bg-dark-card2 px-1.5 py-0.5 rounded text-gray-400 text-[11px]">
                {folder}
              </code>{" "}
              and drop video files in it.
            </p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search profiles..."
                aria-label="Search profiles"
                className="w-full bg-dark-input border border-dark-border rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">Nothing matches</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filtered.map((p) => (
                  <ProfileTile key={p.profile} card={p} library={library} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProfileTile({
  card,
  library,
}: {
  card: ProfileCard;
  library: "clips" | "shorts18";
}) {
  const poster =
    card.sampleSlug && card.sampleHasPoster
      ? `/api/${library}/${urlSlug(card.sampleSlug)}/poster?v=${Math.floor(card.samplePosterMtime)}&t=${encodeURIComponent(mediaToken())}`
      : null;
  const fallbackVideo = card.sampleSlug
    ? `/api/${library}/${urlSlug(card.sampleSlug)}/video?v=${Math.floor(card.sampleVideoMtime)}&t=${encodeURIComponent(mediaToken())}#t=0.1`
    : null;
  const [catOpen, setCatOpen] = useState(false);
  const [catBusy, setCatBusy] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);

  async function bulkMove(category: AdultsFilter) {
    if (catBusy) return;
    setCatBusy(true);
    try {
      const res = await fetch(`/api/${library}/bulk-category`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ profile: card.profile, category }),
      });
      if (res.ok) {
        const data = await res.json();
        setMoved(`${data.moved ?? 0} → ${category}`);
        // Refresh the page so the profile card reflects the new layout.
        if (typeof window !== "undefined") {
          setTimeout(() => window.location.reload(), 400);
        }
      }
    } finally {
      setCatBusy(false);
      setCatOpen(false);
    }
  }

  return (
    <div className="group bg-dark-card hover:bg-dark-card2 border border-dark-border rounded-xl overflow-hidden flex flex-col relative">
      <a
        href={`/${library}/${encodeURIComponent(card.profile)}`}
        className="text-left flex flex-col"
      >
        <div className="relative aspect-[9/16] bg-black flex items-center justify-center">
          {poster ? (
            <img src={poster} alt={card.profile} className="w-full h-full object-cover" loading="lazy" />
          ) : fallbackVideo ? (
            <video
              src={fallbackVideo}
              preload="metadata"
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <Users size={28} className="text-white/20" />
          )}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-white text-[10px] font-semibold drop-shadow">
            <span className="inline-flex items-center gap-0.5 bg-black/50 backdrop-blur-sm rounded-full px-1.5 py-0.5">
              <Film size={10} /> {card.count}
            </span>
          </div>
        </div>
        <div className="p-2.5">
          <p className="text-sm font-medium text-white truncate">@{card.profile}</p>
          <p className="text-[11px] text-gray-500 truncate">
            {card.count} clip{card.count === 1 ? "" : "s"}
          </p>
        </div>
      </a>
      {library === "shorts18" && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCatOpen((v) => !v);
            }}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 hover:bg-pink-500/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            aria-label="Bulk move to category"
            title="Move all to category"
            disabled={catBusy}
          >
            {catBusy ? <Loader2 size={12} className="animate-spin" /> : <Folder size={12} />}
          </button>
          {catOpen && (
            <div
              className="absolute top-9 right-1.5 bg-dark-card border border-dark-border rounded-lg shadow-xl py-1 min-w-[140px] z-30"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-500">
                Move all {card.count}
              </p>
              {ADULTS_FILTER_OPTIONS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => bulkMove(cat)}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-dark-card2"
                >
                  {cat[0].toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          )}
          {moved && (
            <span className="absolute bottom-1.5 right-1.5 bg-emerald-500/90 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {moved}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/* --------------------------- Comments sheet ---------------------------- */

function timeAgo(iso: string): string {
  const t = new Date(iso.replace(" ", "T") + "Z").getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CommentsSheet({
  slug,
  commentsUrl,
  title,
  onClose,
  onCountChange,
}: {
  slug: string;
  /** Full URL for `GET/POST /<endpoint>/comments` — source-aware so it works for both clips/shorts18 and tiktok. */
  commentsUrl: string;
  title: string;
  onClose: () => void;
  onCountChange: (n: number) => void;
}) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [meId, setMeId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m) {
          setMeId(m.id);
          setIsAdmin(!!m.isAdmin);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    fetch(commentsUrl, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as CommentItem[];
      })
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data)) setComments(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, commentsUrl, reloadKey]);

  async function submit() {
    const content = value.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const res = await fetch(commentsUrl, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { comment: CommentItem; count: number };
      setComments((prev) => [data.comment, ...prev]);
      onCountChange(data.count);
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    try {
      const res = await fetch(
        `${commentsUrl}/${id}`,
        { method: "DELETE", headers: authHeaders() },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { count: number };
      setComments((prev) => prev.filter((c) => c.id !== id));
      onCountChange(data.count);
    } catch {}
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-dark-card2 border border-dark-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-dark-border flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Comments</p>
            <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 -mr-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-xs text-gray-500 text-center py-8 flex items-center justify-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Loading...
            </p>
          ) : loadError ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm text-gray-400">Couldn&apos;t load comments.</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Try again
              </button>
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">
              No comments yet. Be the first.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => {
                const canDelete = isAdmin || c.userId === meId;
                return (
                  <li key={c.id} className="flex items-start gap-2.5">
                    <Avatar username={c.username} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">
                        <span className="font-semibold text-white">@{c.username}</span>
                        <span className="text-gray-500"> · {timeAgo(c.createdAt)}</span>
                      </p>
                      <p className="text-sm text-gray-100 mt-0.5 break-words whitespace-pre-line">
                        {c.content}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        className="text-gray-500 hover:text-red-400 p-1 flex-shrink-0"
                        title="Delete comment"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-3 py-3 border-t border-dark-border flex items-end gap-2 flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
          <label className="flex-1 bg-dark-input border border-dark-border rounded-2xl px-4 py-2.5 focus-within:border-blue-500/60 transition-colors cursor-text block">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Add a comment..."
              className="w-full bg-transparent border-0 outline-none resize-none text-[15px] text-gray-100 placeholder-gray-500 max-h-32 leading-relaxed"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || busy}
            aria-label="Send comment"
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-dark-card2 disabled:text-gray-600 disabled:cursor-not-allowed text-white transition-colors"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
