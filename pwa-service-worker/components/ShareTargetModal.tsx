"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Newspaper, Send, Sparkles, X } from "lucide-react";
import Avatar from "./Avatar";

export type ShareSourceKind = "gallery" | "photos" | "external";

export interface ShareSource {
  kind: ShareSourceKind;
  // For gallery items the caller supplies an item id; the modal mints a
  // share-token via the server so other users can view the media.
  galleryItemId?: number;
  // For non-gallery sources the caller supplies an already-public mediaUrl.
  mediaUrl?: string;
  mediaType?: string;
  mediaName?: string;
  // Optional reference (e.g. photos slug) preserved on stories.
  sourceRef?: string;
  // Thumbnail to render in the preview header.
  previewUrl?: string;
}

interface ChannelOption {
  id: number;
  label: string;
  isDm: boolean;
  username?: string;
}

interface UserOption {
  id: number;
  username: string;
  display_name: string | null;
  avatar: string | null;
}

interface ShareTargetModalProps {
  open: boolean;
  /** Single-item share. Ignored when `sources` is provided. */
  source: ShareSource | null;
  /** Multi-item share — posts one per source, in order. */
  sources?: ShareSource[];
  defaultCaption?: string;
  onClose: () => void;
  onShared?: (target: "feed" | "chat" | "story") => void;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : ""}`,
  };
}

async function resolveShareUrl(source: ShareSource): Promise<{ url: string; type: string | null; name: string | null } | null> {
  if (source.kind === "gallery" && source.galleryItemId) {
    const res = await fetch(`/api/gallery/items/${source.galleryItemId}/share-token`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      url: data.url as string,
      type: source.mediaType ?? "image/jpeg",
      name: source.mediaName ?? null,
    };
  }
  if (source.mediaUrl) {
    return {
      url: source.mediaUrl,
      type: source.mediaType ?? null,
      name: source.mediaName ?? null,
    };
  }
  return null;
}

type Tab = "feed" | "chat" | "story";

export default function ShareTargetModal({ open, source, sources, defaultCaption, onClose, onShared }: ShareTargetModalProps) {
  const effectiveSources: ShareSource[] = sources && sources.length > 0
    ? sources
    : source
      ? [source]
      : [];
  const isBulk = effectiveSources.length > 1;
  const previewSource = effectiveSources[0] ?? null;

  const [tab, setTab] = useState<Tab>("feed");
  const [caption, setCaption] = useState(defaultCaption ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Tab | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // chat target state
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [chatTarget, setChatTarget] = useState<{ kind: "channel"; id: number } | { kind: "user"; username: string } | null>(null);
  const [chatQuery, setChatQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("feed");
    setCaption(defaultCaption ?? "");
    setError(null);
    setDone(null);
    setBusy(false);
    setProgress(null);
    setChatTarget(null);
    setChatQuery("");
  }, [open, source?.galleryItemId, source?.mediaUrl, defaultCaption, sources?.length]);

  useEffect(() => {
    if (!open || tab !== "chat") return;
    let cancelled = false;
    Promise.all([
      fetch("/api/channels", { headers: authHeaders() }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/users", { headers: authHeaders() }).then((r) => (r.ok ? r.json() : [])),
    ]).then(([chs, us]) => {
      if (cancelled) return;
      const channelOptions: ChannelOption[] = (Array.isArray(chs) ? chs : [])
        .filter((c: any) => !c.isDm)
        .map((c: any) => ({ id: c.id, label: `#${c.name}`, isDm: false }));
      const userOptions: UserOption[] = (Array.isArray(us) ? us : []).map((u: any) => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name ?? null,
        avatar: u.avatar ?? null,
      }));
      setChannels(channelOptions);
      setUsers(userOptions);
    });
    return () => {
      cancelled = true;
    };
  }, [open, tab]);

  const filteredChannels = useMemo(() => {
    const q = chatQuery.trim().toLowerCase();
    if (!q) return channels.slice(0, 8);
    return channels.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 8);
  }, [channels, chatQuery]);

  const filteredUsers = useMemo(() => {
    const q = chatQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 8);
    return users
      .filter((u) =>
        u.username.toLowerCase().includes(q) ||
        (u.display_name ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [users, chatQuery]);

  if (!open || effectiveSources.length === 0) return null;

  async function shareToFeed() {
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: effectiveSources.length });
    try {
      for (let i = 0; i < effectiveSources.length; i++) {
        const src = effectiveSources[i];
        const resolved = await resolveShareUrl(src);
        if (!resolved) throw new Error(`Couldn't resolve media for item ${i + 1}`);
        const res = await fetch("/api/feed", {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            content: caption.trim() || null,
            mediaUrl: resolved.url,
            mediaType: resolved.type,
            mediaName: resolved.name,
          }),
        });
        if (!res.ok) throw new Error(`Feed POST ${res.status} on item ${i + 1}`);
        setProgress({ done: i + 1, total: effectiveSources.length });
      }
      setDone("feed");
      onShared?.("feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  async function shareToChat() {
    if (!chatTarget) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: effectiveSources.length });
    try {
      let channelId: number;
      if (chatTarget.kind === "channel") {
        channelId = chatTarget.id;
      } else {
        const dm = await fetch("/api/dms", {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ username: chatTarget.username }),
        });
        if (!dm.ok) throw new Error(`DM open ${dm.status}`);
        const dmData = await dm.json();
        channelId = dmData.channelId;
      }

      for (let i = 0; i < effectiveSources.length; i++) {
        const src = effectiveSources[i];
        const resolved = await resolveShareUrl(src);
        if (!resolved) throw new Error(`Couldn't resolve media for item ${i + 1}`);
        // Only attach the caption to the first message so the chat doesn't
        // get spammed with the same line N times.
        const res = await fetch(`/api/channels/${channelId}/messages`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            content: i === 0 ? (caption.trim() || "") : "",
            fileUrl: resolved.url,
            fileType: resolved.type ?? "image/jpeg",
            fileName: resolved.name ?? "shared",
            fileSize: 0,
          }),
        });
        if (!res.ok) throw new Error(`Send ${res.status} on item ${i + 1}`);
        setProgress({ done: i + 1, total: effectiveSources.length });
      }
      setDone("chat");
      onShared?.("chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  async function shareToStory() {
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: effectiveSources.length });
    try {
      for (let i = 0; i < effectiveSources.length; i++) {
        const src = effectiveSources[i];
        const resolved = await resolveShareUrl(src);
        if (!resolved) throw new Error(`Couldn't resolve media for item ${i + 1}`);
        const res = await fetch("/api/stories", {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaUrl: resolved.url,
            mediaType: resolved.type ?? "image/jpeg",
            caption: caption.trim() || null,
            sourceKind: src.kind,
            sourceRef: src.galleryItemId
              ? String(src.galleryItemId)
              : src.sourceRef ?? null,
          }),
        });
        if (!res.ok) throw new Error(`Story ${res.status} on item ${i + 1}`);
        setProgress({ done: i + 1, total: effectiveSources.length });
      }
      setDone("story");
      onShared?.("story");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-dark-card border border-dark-border rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <div className="flex items-center gap-3">
            {previewSource?.previewUrl && (
              <div className="relative">
                <img
                  src={previewSource.previewUrl}
                  alt=""
                  className="w-10 h-10 object-cover rounded-md border border-dark-border"
                />
                {isBulk && (
                  <span className="absolute -top-1.5 -right-1.5 bg-pink-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-dark-card">
                    {effectiveSources.length}
                  </span>
                )}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-white">
                {isBulk ? `Share ${effectiveSources.length} items` : "Share"}
              </p>
              <p className="text-[11px] text-gray-500">
                {isBulk
                  ? "Each item posts separately"
                  : (previewSource?.mediaName ?? previewSource?.kind ?? "")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-dark-card2"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {done ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-emerald-400 text-sm">
              {isBulk
                ? `Shared ${effectiveSources.length} items to ${done === "feed" ? "your feed" : done === "chat" ? "the chat" : "your story"}.`
                : `Shared to ${done === "feed" ? "your feed" : done === "chat" ? "the chat" : "your story"}.`}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <nav className="flex border-b border-dark-border">
              {([
                { id: "feed", label: "Feed", icon: Newspaper },
                { id: "chat", label: "Chat", icon: MessageCircle },
                { id: "story", label: "Story", icon: Sparkles },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm transition-colors ${
                    tab === id
                      ? "text-white border-b-2 border-blue-500 bg-dark-card2/50"
                      : "text-gray-400 hover:text-white hover:bg-dark-card2/30"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </nav>

            <div className="p-4 space-y-3">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                placeholder={
                  tab === "story" ? "Optional caption" : "Say something..."
                }
                className="input resize-none w-full text-sm"
              />

              {tab === "chat" && (
                <div className="space-y-2">
                  <input
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    placeholder="Search channels or users..."
                    className="input w-full text-sm"
                  />
                  <div className="max-h-56 overflow-y-auto border border-dark-border rounded-lg divide-y divide-dark-border">
                    {filteredChannels.map((c) => (
                      <button
                        key={`ch-${c.id}`}
                        type="button"
                        onClick={() => setChatTarget({ kind: "channel", id: c.id })}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                          chatTarget?.kind === "channel" && chatTarget.id === c.id
                            ? "bg-blue-600/20 text-white"
                            : "text-gray-300 hover:bg-dark-card2"
                        }`}
                      >
                        <span className="text-blue-400">#</span>
                        <span>{c.label.replace(/^#/, "")}</span>
                      </button>
                    ))}
                    {filteredUsers.map((u) => (
                      <button
                        key={`u-${u.id}`}
                        type="button"
                        onClick={() => setChatTarget({ kind: "user", username: u.username })}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                          chatTarget?.kind === "user" && chatTarget.username === u.username
                            ? "bg-blue-600/20 text-white"
                            : "text-gray-300 hover:bg-dark-card2"
                        }`}
                      >
                        <Avatar username={u.username} size={20} />
                        <span>{u.display_name || u.username}</span>
                        <span className="text-gray-500">@{u.username}</span>
                      </button>
                    ))}
                    {filteredChannels.length === 0 && filteredUsers.length === 0 && (
                      <p className="px-3 py-3 text-xs text-gray-500 text-center">
                        No matches
                      </p>
                    )}
                  </div>
                </div>
              )}

              {tab === "story" && (
                <p className="text-[11px] text-gray-500">
                  Stories are visible for 24 hours, then auto-delete.
                </p>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-dark-card2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={
                    tab === "feed"
                      ? shareToFeed
                      : tab === "chat"
                        ? shareToChat
                        : shareToStory
                  }
                  disabled={busy || (tab === "chat" && !chatTarget)}
                  className="btn-primary disabled:bg-dark-card2 disabled:text-gray-600 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  {busy && progress
                    ? `${progress.done}/${progress.total}`
                    : isBulk
                      ? `Share ${effectiveSources.length}`
                      : "Share"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
