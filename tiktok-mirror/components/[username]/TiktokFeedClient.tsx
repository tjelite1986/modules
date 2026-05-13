"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Film,
  Heart,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  Send,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { useFullscreen } from "@/lib/useFullscreen";

export interface TiktokVideoSummary {
  videoId: string;
  username: string;
  title: string;
  description: string | null;
  duration: number | null;
  uploadDate: string | null;
  hasPoster: boolean;
  posterMtime: number;
  hasVideo: boolean;
  videoMtime: number;
  url: string;
  likes: number;
  views: number;
  comments: number;
}

interface CommentItem {
  id: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

interface VideoState {
  likes: number;
  views: number;
  comments: number;
  liked: boolean;
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

export default function TiktokFeedClient({
  username,
  displayName,
  videos,
  hideHeader = false,
}: {
  username: string;
  displayName: string | null;
  videos: TiktokVideoSummary[];
  hideHeader?: boolean;
}) {
  const [syncing, setSyncing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } = useFullscreen(rootRef);
  const [state, setState] = useState<Record<string, VideoState>>(() => {
    const init: Record<string, VideoState> = {};
    for (const v of videos) {
      init[v.videoId] = {
        likes: v.likes,
        views: v.views,
        comments: v.comments,
        liked: false,
      };
    }
    return init;
  });
  const [commentsOpenFor, setCommentsOpenFor] = useState<string | null>(null);

  // Pull which videos this user has liked.
  useEffect(() => {
    fetch("/api/tiktok/me/likes", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: string[]) => {
        if (!Array.isArray(ids)) return;
        setState((prev) => {
          const next = { ...prev };
          for (const id of ids) {
            if (next[id]) next[id] = { ...next[id], liked: true };
          }
          return next;
        });
      })
      .catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/tiktok/profiles/${encodeURIComponent(username)}/sync`,
        { method: "POST", headers: authHeaders() },
      );
      if (res.ok && typeof window !== "undefined") {
        window.location.reload();
      }
    } finally {
      setSyncing(false);
    }
  }, [username, syncing]);

  const toggleLike = useCallback(async (videoId: string) => {
    let prevState: VideoState | undefined;
    setState((prev) => {
      prevState = prev[videoId];
      if (!prevState) return prev;
      const liked = !prevState.liked;
      return {
        ...prev,
        [videoId]: {
          ...prevState,
          liked,
          likes: prevState.likes + (liked ? 1 : -1),
        },
      };
    });
    if (!prevState) return;
    const newLiked = !prevState.liked;
    try {
      const res = await fetch(
        `/api/tiktok/${encodeURIComponent(videoId)}/like`,
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ liked: newLiked }),
        },
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { liked: boolean; likes: number; views: number };
      setState((prev) => {
        const c = prev[videoId];
        if (!c) return prev;
        return {
          ...prev,
          [videoId]: { ...c, likes: data.likes, views: data.views, liked: data.liked },
        };
      });
    } catch {
      setState((prev) => {
        const c = prev[videoId];
        if (!c || !prevState) return prev;
        return {
          ...prev,
          [videoId]: { ...c, liked: prevState.liked, likes: prevState.likes },
        };
      });
    }
  }, []);

  const recordView = useCallback(async (videoId: string) => {
    try {
      const res = await fetch(
        `/api/tiktok/${encodeURIComponent(videoId)}/view`,
        { method: "POST", headers: authHeaders() },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { likes: number; views: number };
      setState((prev) => {
        const c = prev[videoId];
        if (!c) return prev;
        if (c.views >= data.views) return prev;
        return { ...prev, [videoId]: { ...c, views: data.views } };
      });
    } catch {}
  }, []);

  const updateCommentCount = useCallback((videoId: string, count: number) => {
    setState((prev) => {
      const c = prev[videoId];
      if (!c) return prev;
      return { ...prev, [videoId]: { ...c, comments: count } };
    });
  }, []);

  const share = useCallback(async (videoId: string, title: string, vidUsername: string) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/videos/tiktok/${encodeURIComponent(vidUsername)}?id=${encodeURIComponent(videoId)}`;
    const data = { title, url };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
  }, []);

  if (videos.length === 0) {
    return (
      <div ref={rootRef} className="absolute inset-0 flex flex-col bg-black">
        {!hideHeader && (
        <Header username={username} displayName={displayName} onSync={sync} syncing={syncing} />
      )}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500 px-6 text-center">
          <Film size={32} className="text-gray-600" />
          <p className="text-sm">No videos yet</p>
          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 inline-flex items-center gap-1"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="absolute inset-0 flex flex-col bg-black">
      {!hideHeader && (
        <Header username={username} displayName={displayName} onSync={sync} syncing={syncing} />
      )}
      <Feed
        videos={videos}
        state={state}
        onToggleLike={toggleLike}
        onView={recordView}
        onOpenComments={(id) => setCommentsOpenFor(id)}
        onShare={share}
        isFullscreen={isFullscreen}
        onToggleFullscreen={fullscreenSupported ? toggleFullscreen : null}
      />
      {commentsOpenFor && (
        <CommentsSheet
          videoId={commentsOpenFor}
          title={
            videos.find((v) => v.videoId === commentsOpenFor)?.title ?? commentsOpenFor
          }
          onClose={() => setCommentsOpenFor(null)}
          onCountChange={(n) => updateCommentCount(commentsOpenFor, n)}
        />
      )}
    </div>
  );
}

function Header({
  username,
  displayName,
  onSync,
  syncing,
}: {
  username: string;
  displayName: string | null;
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <div className="flex-shrink-0 z-30 absolute top-0 left-0 right-0 px-3 py-3 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent">
      <Link
        href="/videos/tiktok"
        aria-label="Back"
        className="w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center"
      >
        <ArrowLeft size={16} />
      </Link>
      <div className="flex-1 min-w-0 px-2">
        <p className="text-sm font-semibold text-white truncate drop-shadow">
          {displayName || username}
        </p>
        <p className="text-[11px] text-white/70 truncate drop-shadow">@{username}</p>
      </div>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        aria-label="Sync"
        className="w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center disabled:opacity-50"
      >
        {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
      </button>
    </div>
  );
}

/* --------------------------- Feed ---------------------------- */

function Feed({
  videos,
  state,
  onToggleLike,
  onView,
  onOpenComments,
  onShare,
  isFullscreen,
  onToggleFullscreen,
}: {
  videos: TiktokVideoSummary[];
  state: Record<string, VideoState>;
  onToggleLike: (id: string) => void;
  onView: (id: string) => void;
  onOpenComments: (id: string) => void;
  onShare: (id: string, title: string, username: string) => void;
  isFullscreen: boolean;
  onToggleFullscreen: (() => void) | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // Scroll to a clip if ?id= is present in the URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) return;
    const idx = videos.findIndex((v) => v.videoId === id);
    if (idx < 0) return;
    const el = containerRef.current?.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "instant", block: "start" });
    setActiveIndex(idx);
  }, [videos]);

  // Prefetch the bytes for activeIndex+2 to make the next swipe feel instant.
  useEffect(() => {
    const next = videos[activeIndex + 2];
    if (!next || !next.hasVideo) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "video";
    link.href = `/api/tiktok/video/${encodeURIComponent(next.videoId)}?v=${Math.floor(next.videoMtime)}`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [activeIndex, videos]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-scroll snap-y snap-mandatory"
      style={{ scrollbarWidth: "none" }}
    >
      <style>{`.feed-scroll::-webkit-scrollbar { display: none; }`}</style>
      {videos.map((v, i) => (
        <FeedItem
          key={v.videoId}
          video={v}
          index={i}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          state={
            state[v.videoId] ?? {
              likes: v.likes,
              views: v.views,
              comments: v.comments,
              liked: false,
            }
          }
          onToggleLike={() => onToggleLike(v.videoId)}
          onView={() => onView(v.videoId)}
          onOpenComments={() => onOpenComments(v.videoId)}
          onShare={() => onShare(v.videoId, v.title, v.username)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
        />
      ))}
    </div>
  );
}

function FeedItem({
  video,
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
  isFullscreen,
  onToggleFullscreen,
}: {
  video: TiktokVideoSummary;
  index: number;
  activeIndex: number;
  onActiveChange: (i: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  state: VideoState;
  onToggleLike: () => void;
  onView: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: (() => void) | null;
}) {
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const viewRecordedRef = useRef(false);
  const isActive = activeIndex === index;
  const distance = Math.abs(activeIndex - index);
  const inWindow = distance <= 1;

  const videoSrc = `/api/tiktok/video/${encodeURIComponent(video.videoId)}${
    video.hasVideo ? `?v=${Math.floor(video.videoMtime)}` : ""
  }`;
  const poster = video.hasPoster
    ? `/api/tiktok/poster/${encodeURIComponent(video.videoId)}?v=${Math.floor(video.posterMtime)}`
    : undefined;

  // Visibility tracking
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

  // Attach src only inside window; explicit cleanup outside.
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

  // Spinner while lazy download is in flight on first watch.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isActive) return;
    if (video.hasVideo) {
      setDownloading(false);
      return;
    }
    setDownloading(true);
    const onLoaded = () => setDownloading(false);
    v.addEventListener("loadeddata", onLoaded);
    return () => v.removeEventListener("loadeddata", onLoaded);
  }, [isActive, video.hasVideo]);

  // Play/pause based on active state
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !inWindow) return;
    if (isActive && !paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
      if (!isActive) v.currentTime = 0;
    }
  }, [isActive, paused, inWindow]);

  // Record a view after 3 sec active
  useEffect(() => {
    if (!isActive || viewRecordedRef.current) return;
    const t = setTimeout(() => {
      viewRecordedRef.current = true;
      onView();
    }, 3000);
    return () => clearTimeout(t);
  }, [isActive, onView]);

  function togglePlay() {
    setPaused((p) => {
      setShowOverlay(true);
      setTimeout(() => setShowOverlay(false), 600);
      return !p;
    });
  }

  function handleLikeClick() {
    if (!state.liked) {
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 700);
    }
    onToggleLike();
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(video.videoId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
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

      {downloading && isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="bg-black/60 rounded-2xl px-4 py-3 backdrop-blur-sm flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-white" />
            <span className="text-white text-sm">Fetching from TikTok...</span>
          </div>
        </div>
      )}

      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 rounded-full p-5 backdrop-blur-sm">
            {paused ? <Pause size={36} className="text-white" /> : <Play size={36} className="text-white" />}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pb-6 pointer-events-none">
        <div className="max-w-2xl pr-16">
          <div className="flex items-start gap-2">
            <h2
              className="text-white text-base font-semibold drop-shadow line-clamp-2 select-text pointer-events-auto cursor-text flex-1 min-w-0"
              title={video.videoId}
            >
              {video.title}
            </h2>
            <button
              type="button"
              onClick={copyId}
              aria-label="Copy video id"
              className="flex-shrink-0 w-7 h-7 -mt-0.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white/80 hover:text-white flex items-center justify-center pointer-events-auto transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
          <Link
            href={`/videos/tiktok/${encodeURIComponent(video.username)}`}
            className="text-white/70 text-xs mt-0.5 pointer-events-auto inline-block hover:text-white"
          >
            @{video.username}
          </Link>
          {video.description && video.description !== video.title && (
            <p className="text-white/85 text-sm mt-1 line-clamp-3 whitespace-pre-line drop-shadow select-text pointer-events-auto cursor-text">
              {video.description}
            </p>
          )}
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-blue-300 hover:text-blue-200 pointer-events-auto"
          >
            <ExternalLink size={11} /> Open on TikTok
          </a>
        </div>
      </div>

      {/* Right-side controls */}
      <div className="absolute right-3 bottom-24 flex flex-col gap-4 z-10">
        <button
          type="button"
          onClick={handleLikeClick}
          aria-label={state.liked ? "Unlike" : "Like"}
          aria-pressed={state.liked}
          className="flex flex-col items-center gap-1 group"
        >
          <span
            className={`w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center transition-all ${
              state.liked
                ? "bg-rose-500/90 text-white scale-110"
                : "bg-black/50 hover:bg-black/70 text-white"
            }`}
          >
            <Heart size={22} className={state.liked ? "fill-current" : ""} />
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

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center mx-auto"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center mx-auto"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        )}
      </div>

      {showHeartBurst && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart
            size={120}
            className="text-rose-500 fill-rose-500 drop-shadow-2xl animate-ping"
            style={{ animationDuration: "700ms", animationIterationCount: 1 }}
          />
        </div>
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
  videoId,
  title,
  onClose,
  onCountChange,
}: {
  videoId: string;
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
    fetch(`/api/tiktok/${encodeURIComponent(videoId)}/comments`, { headers: authHeaders() })
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
  }, [videoId, reloadKey]);

  async function submit() {
    const content = value.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/tiktok/${encodeURIComponent(videoId)}/comments`,
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
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
        `/api/tiktok/${encodeURIComponent(videoId)}/comments/${id}`,
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
            aria-label="Close"
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
                        aria-label="Delete comment"
                        className="text-gray-500 hover:text-red-400 p-1 flex-shrink-0"
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
