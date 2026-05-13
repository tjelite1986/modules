"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  Film,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Instagram as InstagramIcon,
} from "lucide-react";
import Avatar from "@/components/Avatar";

interface IgProfile {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  postCount: number | null;
  addedAt: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  hasFiles: boolean;
  fileCount: number;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : ""}`,
  };
}

export default function InstagramClient() {
  const [profiles, setProfiles] = useState<IgProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [busyByUser, setBusyByUser] = useState<Record<string, "sync" | "info" | "delete" | "wipe-videos">>({});
  const [logByUser, setLogByUser] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState<"none" | "wipe-all">("none");
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [syncFilter, setSyncFilter] = useState<"all" | "synced" | "unsynced">("all");

  async function bulkDeleteVideos() {
    if (!confirm(`Delete every saved video file across ALL ${profiles.length} tracked profiles? Photos and archives are kept.`)) return;
    setBulkBusy("wipe-all");
    setBulkMsg("Deleting…");
    try {
      const res = await fetch("/api/instagram/delete-all-videos", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkMsg(`Removed ${data?.totalRemoved ?? 0} video file(s) across ${data?.perProfile?.length ?? 0} profiles`);
      } else {
        setBulkMsg(data?.error ?? "Bulk delete failed");
      }
      await load();
    } finally {
      setBulkBusy("none");
    }
  }

  // Per-profile delete-videos (defined below alongside other profile actions)
  async function deleteVideos(username: string) {
    if (!confirm(`Delete every saved video file for @${username}? Photos are kept.`)) return;
    setBusyByUser((prev) => ({ ...prev, [username]: "wipe-videos" }));
    try {
      const res = await fetch(`/api/instagram/profiles/${encodeURIComponent(username)}/delete-videos`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      setLogByUser((prev) => ({
        ...prev,
        [username]: res.ok ? `Removed ${data?.removed ?? 0} video file(s)` : (data?.error ?? "Delete failed"),
      }));
      await load();
    } finally {
      setBusyByUser((prev) => {
        const next = { ...prev };
        delete next[username];
        return next;
      });
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/instagram/profiles", { headers: authHeaders() });
      const data = await res.json();
      setProfiles(Array.isArray(data?.profiles) ? data.profiles : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/instagram/profiles", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data?.error ?? "Add failed");
        return;
      }
      setInput("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function fetchInfo(username: string) {
    setBusyByUser((prev) => ({ ...prev, [username]: "info" }));
    try {
      const res = await fetch(`/api/instagram/profiles/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      const data = await res.json();
      setLogByUser((prev) => ({
        ...prev,
        [username]: data?.fetched
          ? `Updated profile info (${data.fetched.postCount ?? "?"} posts)`
          : "Couldn't fetch profile info (Instagram may be rate-limiting)",
      }));
      await load();
    } finally {
      setBusyByUser((prev) => {
        const next = { ...prev };
        delete next[username];
        return next;
      });
    }
  }

  async function sync(username: string, mode: "all" | "photos" = "all") {
    setBusyByUser((prev) => ({ ...prev, [username]: "sync" }));
    setLogByUser((prev) => ({
      ...prev,
      [username]: mode === "photos"
        ? "Syncing photos only…"
        : "Syncing all media…",
    }));
    try {
      const res = await fetch(`/api/instagram/profiles/${encodeURIComponent(username)}/sync`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      const r = data?.result;
      if (r?.ok) {
        setLogByUser((prev) => ({
          ...prev,
          [username]: `Synced ${r.mode === "photos" ? "(photos only) " : ""}via ${r.tool} — added ${r.added} (now ${r.filesAfter})`,
        }));
      } else {
        setLogByUser((prev) => ({
          ...prev,
          [username]: r?.error ?? "Sync failed",
        }));
      }
      await load();
    } finally {
      setBusyByUser((prev) => {
        const next = { ...prev };
        delete next[username];
        return next;
      });
    }
  }

  async function remove(username: string) {
    if (!confirm(`Remove @${username} from the tracked list? Files on disk are kept.`)) return;
    setBusyByUser((prev) => ({ ...prev, [username]: "delete" }));
    try {
      await fetch(`/api/instagram/profiles/${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      await load();
    } finally {
      setBusyByUser((prev) => {
        const next = { ...prev };
        delete next[username];
        return next;
      });
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-0 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <InstagramIcon size={20} className="text-pink-400" /> InstaElite — Manage
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Track public Instagram profiles. Synced media lands in
          <code className="mx-1 bg-dark-card2 px-1.5 py-0.5 rounded text-[11px] text-gray-400">/instagram/&lt;username&gt;/</code>
          and shows up in the Browse tab + /feed Discover.
        </p>
      </header>

      <CookiesStatus />

      <section className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
        <form onSubmit={add} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Instagram URL or @username"
            className="flex-1 bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-pink-500/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || adding}
            className="btn-primary disabled:opacity-50"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add profile
          </button>
        </form>
        {addError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2 mt-2">
            {addError}
          </p>
        )}
        <p className="text-[11px] text-gray-500 mt-2">
          Examples: <code className="bg-dark-card2 px-1 rounded">https://www.instagram.com/natgeo/</code>,
          <code className="bg-dark-card2 px-1 rounded ml-1">natgeo</code>,
          <code className="bg-dark-card2 px-1 rounded ml-1">@natgeo</code>.
        </p>
      </section>

      {profiles.length > 0 && (() => {
        const syncedCount = profiles.filter((p) => p.lastSyncedAt).length;
        const unsyncedCount = profiles.length - syncedCount;
        return (
          <section className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400 mr-1">Filter:</span>
              {([
                { id: "all" as const, label: `All (${profiles.length})` },
                { id: "synced" as const, label: `Synced (${syncedCount})` },
                { id: "unsynced" as const, label: `Not synced (${unsyncedCount})` },
              ]).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSyncFilter(id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    syncFilter === id
                      ? "bg-pink-500/25 text-pink-200 border-pink-500/50"
                      : "bg-dark-card2 text-gray-300 border-dark-border hover:bg-dark-border"
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="flex-1" />
              <button
                type="button"
                onClick={bulkDeleteVideos}
                disabled={bulkBusy !== "none"}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 disabled:opacity-50 flex items-center gap-1.5"
              >
                {bulkBusy === "wipe-all" ? <Loader2 size={12} className="animate-spin" /> : <Film size={12} />}
                Delete all videos
              </button>
            </div>
            {bulkMsg && (
              <span className="block text-[11px] text-gray-300">{bulkMsg}</span>
            )}
          </section>
        );
      })()}

      {loading ? (
        <p className="text-sm text-gray-500 text-center py-12 flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">
          No tracked profiles yet. Paste an Instagram URL above to get started.
        </p>
      ) : (() => {
        const visible = profiles.filter((p) =>
          syncFilter === "all" ? true
            : syncFilter === "synced" ? !!p.lastSyncedAt
            : !p.lastSyncedAt,
        );
        if (visible.length === 0) {
          return (
            <p className="text-sm text-gray-500 text-center py-12">
              No profiles match this filter.
            </p>
          );
        }
        return (
        <ul className="space-y-3">
          {visible.map((p) => {
            const busy = busyByUser[p.username];
            const log = logByUser[p.username];
            return (
              <li
                key={p.username}
                className="bg-dark-card border border-dark-border rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar username={p.username} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/photos/${encodeURIComponent(p.username)}`}
                        className="text-sm font-semibold text-white hover:underline"
                      >
                        @{p.username}
                      </Link>
                      {p.displayName && (
                        <span className="text-sm text-gray-300">— {p.displayName}</span>
                      )}
                      <a
                        href={`https://www.instagram.com/${p.username}/`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[11px] text-pink-400 hover:text-pink-300"
                      >
                        IG ↗
                      </a>
                    </div>
                    {p.bio && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.bio}</p>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1">
                      {p.fileCount} file{p.fileCount === 1 ? "" : "s"} on disk
                      {typeof p.postCount === "number" && ` · ${p.postCount} posts on IG`}
                      {p.lastSyncedAt && ` · last sync ${timeAgo(p.lastSyncedAt)}`}
                      {!p.lastSyncedAt && " · never synced"}
                    </p>
                    {p.lastSyncError && (
                      <p className="text-[11px] text-red-400 mt-1 truncate" title={p.lastSyncError}>
                        Last error: {p.lastSyncError}
                      </p>
                    )}
                    {log && (
                      <p className="text-[11px] text-emerald-300 mt-1">{log}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => fetchInfo(p.username)}
                      disabled={!!busy}
                      className="text-xs px-2 py-1.5 rounded-lg bg-dark-card2 hover:bg-dark-border text-gray-300 disabled:opacity-50 flex items-center gap-1"
                      title="Fetch profile info"
                    >
                      {busy === "info" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Info
                    </button>
                    <SyncMenu
                      username={p.username}
                      busy={busy === "sync"}
                      onSync={(mode) => sync(p.username, mode)}
                    />
                    <button
                      type="button"
                      onClick={() => deleteVideos(p.username)}
                      disabled={!!busy}
                      className="text-xs px-2 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 disabled:opacity-50 flex items-center gap-1"
                      title="Delete every saved video file (photos kept)"
                    >
                      {busy === "wipe-videos" ? <Loader2 size={12} className="animate-spin" /> : <Film size={12} />}
                      <X size={9} className="-ml-0.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(p.username)}
                      disabled={!!busy}
                      className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                      title="Remove from tracked list"
                    >
                      {busy === "delete" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        );
      })()}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SyncMenu({
  username,
  busy,
  onSync,
}: {
  username: string;
  busy: boolean;
  onSync: (mode: "all" | "photos") => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-label={`Sync ${username}`}
        className="text-xs px-2 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-500/40 disabled:opacity-50 flex items-center gap-1"
        title="Download new posts"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
        Sync
        <span className="opacity-60">▾</span>
      </button>
      {open && !busy && (
        <div
          className="absolute right-0 mt-1 bg-dark-card border border-dark-border rounded-lg shadow-xl py-1 min-w-[150px] z-30"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSync("all");
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-dark-card2"
          >
            All media
            <span className="block text-[10px] text-gray-500">photos + videos + reels</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSync("photos");
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-dark-card2 border-t border-dark-border"
          >
            Photos only
            <span className="block text-[10px] text-gray-500">skips reels &amp; video posts</span>
          </button>
        </div>
      )}
    </div>
  );
}

function CookiesStatus() {
  const [state, setState] = useState<{ enabled: boolean; hostPath: string } | null>(null);

  async function refresh() {
    const res = await fetch("/api/instagram/cookies", { headers: authHeaders() });
    if (res.ok) setState(await res.json());
  }

  useEffect(() => {
    refresh();
  }, []);

  if (!state) return null;

  return (
    <section className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex items-center justify-center rounded-full w-6 h-6 text-[11px] font-bold ${
            state.enabled
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
          }`}
        >
          {state.enabled ? "✓" : "!"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            Session cookies: {state.enabled ? "active" : "not set"}
          </p>
          {state.enabled ? (
            <p className="text-xs text-gray-500 mt-1">
              Logged-in scrape mode — Info + Sync work without rate-limit blocks. Cookies typically last weeks until Instagram rotates them.
            </p>
          ) : (
            <div className="text-xs text-gray-500 mt-1 space-y-1">
              <p>
                Anonymous mode — Instagram will rate-limit you (HTTP 429 / login redirects) on most requests. Add cookies once for a stable flow:
              </p>
              <ol className="list-decimal list-inside ml-1 space-y-0.5 text-gray-400">
                <li>Log in to instagram.com in your browser.</li>
                <li>Install a "Get cookies.txt LOCALLY" extension (Chrome / Firefox).</li>
                <li>Visit instagram.com, click the extension, save the file as
                  <code className="mx-1 bg-dark-card2 px-1.5 py-0.5 rounded text-gray-300 text-[11px]">{state.hostPath}</code>
                  on the Pi.
                </li>
                <li>
                  Click below to re-check.
                </li>
              </ol>
              <button
                type="button"
                onClick={refresh}
                className="mt-2 text-xs text-pink-400 hover:text-pink-300 underline"
              >
                Re-check
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
