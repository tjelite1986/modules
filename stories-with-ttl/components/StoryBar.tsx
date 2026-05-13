"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import Avatar from "./Avatar";
import StoryViewer from "./StoryViewer";

interface StoryUserGroup {
  user_id: number;
  username: string;
  display_name: string | null;
  avatar: string | null;
  story_count: number;
  latest_at: string;
  has_unviewed: number | boolean;
}

interface StoryBarProps {
  meUsername?: string | null;
  onAddClick?: () => void;
  reloadKey?: number;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : ""}`,
  };
}

export default function StoryBar({ meUsername, onAddClick, reloadKey }: StoryBarProps) {
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<StoryUserGroup[]>([]);
  const [openUsername, setOpenUsername] = useState<string | null>(null);
  const [autoOpenedOnce, setAutoOpenedOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stories", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((d) => {
        if (!cancelled) setGroups(Array.isArray(d.groups) ? d.groups : []);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Notification deep-links to /feed?story=<username> should auto-open the
  // viewer for that user once the story list has loaded.
  useEffect(() => {
    if (autoOpenedOnce) return;
    const target = searchParams.get("story");
    if (!target) return;
    if (groups.some((g) => g.username === target)) {
      setOpenUsername(target);
      setAutoOpenedOnce(true);
    }
  }, [groups, searchParams, autoOpenedOnce]);

  const orderedUsernames = groups.map((g) => g.username);

  return (
    <>
      <section className="bg-dark-card border border-dark-border rounded-xl px-3 py-3">
        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
          {meUsername && (
            <button
              type="button"
              onClick={onAddClick}
              className="flex flex-col items-center gap-1 min-w-[64px] flex-shrink-0 group"
              aria-label="Add story"
            >
              <span className="relative">
                <span className="rounded-full p-[2px] bg-dark-card2 inline-block">
                  <Avatar username={meUsername} size={56} />
                </span>
                <span className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-dark-card">
                  <Plus size={10} className="text-white" />
                </span>
              </span>
              <span className="text-[11px] text-gray-300 group-hover:text-white truncate max-w-[64px]">
                Your story
              </span>
            </button>
          )}
          {groups.length === 0 && (
            <p className="text-xs text-gray-500 flex items-center gap-2 px-2">
              <Sparkles size={12} className="text-pink-400" />
              No stories yet — share a gallery item to start one.
            </p>
          )}
          {groups.map((g) => (
            <button
              key={g.user_id}
              type="button"
              onClick={() => setOpenUsername(g.username)}
              className="flex flex-col items-center gap-1 min-w-[64px] flex-shrink-0 group"
            >
              <span
                className={`rounded-full p-[2px] inline-block ${
                  g.has_unviewed
                    ? "bg-gradient-to-tr from-pink-500 via-purple-500 to-orange-400"
                    : "bg-gray-700"
                }`}
              >
                <span className="block rounded-full bg-dark-card p-[2px]">
                  <Avatar username={g.username} size={52} />
                </span>
              </span>
              <span className="text-[11px] text-gray-300 group-hover:text-white truncate max-w-[64px]">
                {g.display_name || g.username}
              </span>
            </button>
          ))}
        </div>
      </section>

      {openUsername && (
        <StoryViewer
          username={openUsername}
          allUsernames={orderedUsernames}
          onClose={() => setOpenUsername(null)}
          onAdvanceUser={(next) => setOpenUsername(next)}
        />
      )}
    </>
  );
}
