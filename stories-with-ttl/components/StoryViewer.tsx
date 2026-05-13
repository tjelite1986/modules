"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import Avatar from "./Avatar";

interface Story {
  id: number;
  user_id: number;
  username: string;
  display_name: string | null;
  avatar: string | null;
  media_url: string;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  expires_at: string;
  view_count: number;
  viewed_by_me: number | boolean;
}

interface StoryViewerProps {
  username: string;
  allUsernames: string[];
  onClose: () => void;
  onAdvanceUser: (next: string | null) => void;
  onDeleted?: () => void;
}

const STORY_DURATION_MS = 5000;

function authHeaders() {
  return {
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : ""}`,
  };
}

function withAuth(url: string) {
  if (!url.startsWith("/api/")) return url;
  const sep = url.includes("?") ? "&" : "?";
  const tok = typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : "";
  return `${url}${sep}t=${encodeURIComponent(tok)}`;
}

export default function StoryViewer({ username, allUsernames, onClose, onAdvanceUser, onDeleted }: StoryViewerProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [me, setMe] = useState<{ id: number } | null>(null);
  const startedAt = useRef<number>(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/stories/user/${encodeURIComponent(username)}`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : { stories: [] })),
      fetch("/api/auth/me", { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
    ]).then(([s, m]) => {
      if (cancelled) return;
      const ss: Story[] = Array.isArray(s.stories) ? s.stories : [];
      setStories(ss);
      setActiveIdx(0);
      setMe(m ? { id: m.id } : null);
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const active = stories[activeIdx];

  useEffect(() => {
    if (!active) return;
    fetch(`/api/stories/${active.id}/view`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
    startedAt.current = performance.now();
    setProgress(0);
    function tick(now: number) {
      const elapsed = now - startedAt.current;
      const p = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(p);
      if (p < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        advance(1);
      }
    }
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [active?.id]);

  function advance(dir: 1 | -1) {
    const next = activeIdx + dir;
    if (next >= 0 && next < stories.length) {
      setActiveIdx(next);
      return;
    }
    if (dir === 1) {
      const i = allUsernames.indexOf(username);
      const nextUser = i >= 0 && i < allUsernames.length - 1 ? allUsernames[i + 1] : null;
      if (nextUser) onAdvanceUser(nextUser);
      else onClose();
    } else {
      const i = allUsernames.indexOf(username);
      const prevUser = i > 0 ? allUsernames[i - 1] : null;
      if (prevUser) onAdvanceUser(prevUser);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") advance(1);
      else if (e.key === "ArrowLeft") advance(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, stories.length]);

  async function deleteCurrent() {
    if (!active) return;
    if (!confirm("Delete this story?")) return;
    const res = await fetch(`/api/stories/${active.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      const newList = stories.filter((s) => s.id !== active.id);
      setStories(newList);
      if (newList.length === 0) {
        onDeleted?.();
        onClose();
      } else if (activeIdx >= newList.length) {
        setActiveIdx(newList.length - 1);
      }
    }
  }

  if (!active) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center" onClick={onClose}>
        <p className="text-gray-400 text-sm">No active stories.</p>
      </div>
    );
  }

  const isMine = me && active.user_id === me.id;

  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="absolute top-0 left-0 right-0 px-4 pt-4 z-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 mb-3">
          {stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white"
                style={{
                  width:
                    i < activeIdx
                      ? "100%"
                      : i === activeIdx
                        ? `${progress * 100}%`
                        : "0%",
                  transition: i === activeIdx ? "none" : "width 0.2s",
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Avatar username={active.username} size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-semibold">
              {active.display_name || active.username}
            </p>
            <p className="text-[11px] text-gray-400">
              {new Date(active.created_at.replace(" ", "T") + "Z").toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          {isMine && (
            <button
              type="button"
              onClick={deleteCurrent}
              className="text-gray-300 hover:text-red-400 p-2"
              aria-label="Delete story"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 hover:text-white p-2"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={withAuth(active.media_url)}
          alt={active.caption ?? ""}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {active.caption && (
        <div
          className="absolute bottom-12 left-0 right-0 px-6 text-center text-white text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="bg-black/60 rounded-lg px-3 py-1.5">{active.caption}</span>
        </div>
      )}

      <div
        className="absolute bottom-2 left-0 right-0 flex items-center justify-between px-4 text-[11px] text-gray-400"
        onClick={(e) => e.stopPropagation()}
      >
        <span>{active.view_count} views</span>
        <span>
          {activeIdx + 1} / {stories.length}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          advance(-1);
        }}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-white/60 hover:text-white"
        aria-label="Previous story"
      >
        <ChevronLeft size={28} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          advance(1);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/60 hover:text-white"
        aria-label="Next story"
      >
        <ChevronRight size={28} />
      </button>
    </div>
  );
}
