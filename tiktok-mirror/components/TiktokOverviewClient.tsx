"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Compass,
  Eye,
  Film,
  Heart,
  Loader2,
  Music2,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import TiktokFeedClient, { type TiktokVideoSummary } from "./[username]/TiktokFeedClient";

export interface ProfileSummary {
  username: string;
  displayName: string | null;
  avatarPath: string | null;
  lastSyncedAt: string | null;
  videoCount: number;
}

export interface TiktokOverviewProps {
  profiles: ProfileSummary[];
  videos: TiktokVideoSummary[];
}

type Tab = "videos" | "explore" | "follows";

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

export default function TiktokOverviewClient({ profiles, videos }: TiktokOverviewProps) {
  const [tab, setTab] = useState<Tab>("videos");
  const [showImport, setShowImport] = useState(false);

  // Read ?tab= once at mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "explore" || t === "follows" || t === "videos") setTab(t);
  }, []);

  function changeTab(next: Tab) {
    setTab(next);
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (next === "videos") sp.delete("tab");
    else sp.set("tab", next);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  function reload() {
    if (typeof window !== "undefined") window.location.reload();
  }

  if (profiles.length === 0) {
    return (
      <div className="max-w-2xl mx-auto pb-12 space-y-6">
        <Header onImport={() => setShowImport(true)} count={0} />
        <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center text-gray-500">
          <Music2 size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-sm">No profiles imported yet.</p>
          <p className="text-xs mt-1">
            Click <span className="text-white">Import</span> and paste a TikTok profile or video URL.
          </p>
        </div>
        {showImport && (
          <ImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); reload(); }} />
        )}
      </div>
    );
  }

  if (tab === "videos") {
    return (
      <>
        <TabBar tab={tab} onChange={changeTab} videoCount={videos.length} profileCount={profiles.length} onImport={() => setShowImport(true)} />
        {videos.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
            No videos yet — add some in Explore or sync a profile.
          </div>
        ) : (
          <div className="absolute inset-0 pt-12">
            <TiktokFeedClient username="" displayName={null} videos={videos} hideHeader />
          </div>
        )}
        {showImport && (
          <ImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); reload(); }} />
        )}
      </>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-4">
      <Header onImport={() => setShowImport(true)} count={profiles.length} />
      <TabBar tab={tab} onChange={changeTab} videoCount={videos.length} profileCount={profiles.length} onImport={() => setShowImport(true)} inline />
      {tab === "explore" ? (
        <ExploreGrid videos={videos} />
      ) : (
        <FollowsGrid profiles={profiles} />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); reload(); }} />
      )}
    </div>
  );
}

function Header({ onImport, count }: { onImport: () => void; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Music2 size={22} /> TikTok
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {count} profile{count === 1 ? "" : "s"}
        </p>
      </div>
      <button type="button" onClick={onImport} className="btn-primary">
        <Plus size={14} /> Import
      </button>
    </div>
  );
}

function TabBar({
  tab,
  onChange,
  videoCount,
  profileCount,
  onImport,
  inline = false,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  videoCount: number;
  profileCount: number;
  onImport: () => void;
  inline?: boolean;
}) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    inline ? (
      <div className="bg-dark-card border border-dark-border rounded-xl p-1 flex items-center gap-1">
        {children}
      </div>
    ) : (
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/85 to-black/40 backdrop-blur-sm flex items-center justify-between px-3 py-2 pointer-events-none">
        <div className="flex items-center gap-1 bg-black/50 rounded-full p-0.5 pointer-events-auto">
          {children}
        </div>
        <button
          type="button"
          onClick={onImport}
          aria-label="Import"
          className="w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center pointer-events-auto"
        >
          <Plus size={14} />
        </button>
      </div>
    );

  const btnCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      active ? "bg-white text-black" : "text-white/80 hover:text-white"
    }`;

  return (
    <Wrapper>
      <button type="button" onClick={() => onChange("videos")} className={btnCls(tab === "videos")}>
        <Film size={13} /> Videos
        {videoCount > 0 && <span className="opacity-70">({videoCount})</span>}
      </button>
      <button type="button" onClick={() => onChange("explore")} className={btnCls(tab === "explore")}>
        <Compass size={13} /> Explore
      </button>
      <button type="button" onClick={() => onChange("follows")} className={btnCls(tab === "follows")}>
        <Users size={13} /> Follows
        {profileCount > 0 && <span className="opacity-70">({profileCount})</span>}
      </button>
    </Wrapper>
  );
}

function ExploreGrid({ videos }: { videos: TiktokVideoSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.username.toLowerCase().includes(q) ||
        (v.description ?? "").toLowerCase().includes(q),
    );
  }, [videos, query]);

  if (videos.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-12">
        No videos yet. Sync a profile or add via the Import button.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search videos..."
          aria-label="Search videos"
          className="w-full bg-dark-input border border-dark-border rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">Nothing matches.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((v) => (
            <VideoTile key={v.videoId} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoTile({ video }: { video: TiktokVideoSummary }) {
  const poster = video.hasPoster
    ? `/api/tiktok/poster/${encodeURIComponent(video.videoId)}?v=${Math.floor(video.posterMtime)}`
    : null;
  return (
    <Link
      href={`/videos/tiktok/${encodeURIComponent(video.username)}?id=${encodeURIComponent(video.videoId)}`}
      className="group bg-dark-card hover:bg-dark-card2 border border-dark-border rounded-xl overflow-hidden text-left transition-colors flex flex-col"
    >
      <div className="relative aspect-[9/16] bg-black flex items-center justify-center">
        {poster ? (
          <img src={poster} alt={video.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Film size={28} className="text-white/20" />
        )}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-white text-[10px] font-semibold drop-shadow">
          <span className="inline-flex items-center gap-0.5 bg-black/50 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <Eye size={10} /> {compactNumber(video.views)}
          </span>
          <span className="inline-flex items-center gap-0.5 bg-black/50 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <Heart size={10} /> {compactNumber(video.likes)}
          </span>
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-sm font-medium text-white truncate">{video.title}</p>
        <p className="text-[11px] text-gray-500 truncate">@{video.username}</p>
      </div>
    </Link>
  );
}

function FollowsGrid({ profiles }: { profiles: ProfileSummary[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {profiles.map((p) => (
        <Link
          key={p.username}
          href={`/videos/tiktok/${encodeURIComponent(p.username)}`}
          className="group bg-dark-card hover:bg-dark-card2 border border-dark-border rounded-xl p-4 transition-colors flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden mb-3">
            {p.username.charAt(0).toUpperCase()}
          </div>
          <p className="text-sm font-semibold text-white truncate w-full">
            {p.displayName || p.username}
          </p>
          <p className="text-xs text-gray-500 truncate w-full">@{p.username}</p>
          <p className="text-[11px] text-gray-600 mt-2">
            {p.videoCount} video{p.videoCount === 1 ? "" : "s"}
          </p>
        </Link>
      ))}
    </div>
  );
}

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const v = url.trim();
    if (!v || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tiktok/import", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ url: v }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed");
      }
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }, [url, busy, onImported]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-dark-card2 border border-dark-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-dark-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Import TikTok</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-white p-1 -mr-1"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">
            Paste a profile (e.g. <code className="text-gray-400">https://www.tiktok.com/@matt_rife</code>) or a single video URL. Profile imports fetch the latest 30 videos.
          </p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="https://www.tiktok.com/@..."
            className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <p className="text-[11px] text-gray-600">
            Videos download lazily — only on first watch — to save space.
          </p>
        </div>
        <div className="px-4 py-3 border-t border-dark-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !url.trim()}
            className="btn-primary disabled:bg-dark-card2 disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Importing...
              </>
            ) : (
              <>
                <RefreshCw size={14} /> Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
