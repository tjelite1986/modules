"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Award,
  Sparkles,
  Camera,
  CircleCheck,
  Users,
  Tag,
  Rocket,
  Shield,
  UserPlus,
  AtSign,
  Image as ImageIcon,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSocket } from "@/lib/socket";

interface Notification {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  Camera,
  CircleCheck,
  Users,
  Tag,
  Rocket,
  Shield,
  Award,
};

export default function NotificationsBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const socket = useSocket();

  function load() {
    fetch("/api/notifications", {
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setUnread(data.unread ?? 0);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onNew(n: Notification) {
      setItems((arr) => [n, ...arr].slice(0, 50));
      setUnread((u) => u + 1);
    }
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, [socket]);

  async function openDropdown() {
    setOpen(true);
    if (unread > 0) {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}` },
      });
      setUnread(0);
      setItems((arr) =>
        arr.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
      );
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="relative p-2 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-dark-card transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-dark-card2 border border-dark-border rounded-lg shadow-xl z-20 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
              <span className="text-sm font-medium text-white">Notifications</span>
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">No notifications yet</p>
            ) : (
              <ul className="divide-y divide-dark-border">
                {items.map((n) => (
                  <NotificationItem key={n.id} n={n} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NotificationItem({ n }: { n: Notification }) {
  if (n.type === "mention") {
    const username = (n.payload.fromUsername as string) ?? "Someone";
    const channelId = n.payload.channelId as number | undefined;
    const preview = (n.payload.preview as string) ?? "";
    return (
      <li className="px-4 py-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <AtSign size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white">
            <Link
              href={`/u/${encodeURIComponent(username)}`}
              className="font-medium hover:underline"
            >
              @{username}
            </Link>{" "}
            mentioned you
          </p>
          {preview && <p className="text-xs text-gray-400 mt-0.5 truncate">"{preview}"</p>}
          <Link
            href={channelId ? `/channels?id=${channelId}` : "/channels"}
            className="text-xs text-blue-400 mt-1 inline-block hover:underline"
          >
            Open channel · {timeAgo(n.createdAt)}
          </Link>
        </div>
      </li>
    );
  }

  if (n.type === "follow.received") {
    const username = (n.payload.followerUsername as string) ?? "Someone";
    return (
      <li className="px-4 py-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <UserPlus size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white">
            <Link
              href={`/u/${encodeURIComponent(username)}`}
              className="font-medium hover:underline"
            >
              @{username}
            </Link>{" "}
            started following you
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{timeAgo(n.createdAt)}</p>
        </div>
      </li>
    );
  }

  if (n.type === "feed.post") {
    const username = (n.payload.authorUsername as string) ?? "Someone";
    const display = (n.payload.authorDisplayName as string) ?? username;
    const preview = (n.payload.preview as string) ?? "";
    const hasMedia = !!n.payload.hasMedia;
    const postId = n.payload.postId as number | undefined;
    return (
      <li className="px-4 py-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-pink-500/15 text-pink-300 border border-pink-500/30 flex items-center justify-center flex-shrink-0">
          <Newspaper size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white">
            <Link
              href={`/u/${encodeURIComponent(username)}`}
              className="font-medium hover:underline"
            >
              @{username}
            </Link>{" "}
            posted{hasMedia ? " a photo" : ""}
          </p>
          {preview && <p className="text-xs text-gray-400 mt-0.5 truncate">"{preview}"</p>}
          <Link
            href={postId ? `/feed?post=${postId}` : "/feed"}
            className="text-xs text-pink-400 mt-1 inline-block hover:underline"
          >
            Open feed · {timeAgo(n.createdAt)}
          </Link>
        </div>
      </li>
    );
  }

  if (n.type === "story.new") {
    const username = (n.payload.authorUsername as string) ?? "Someone";
    const caption = (n.payload.caption as string) ?? "";
    return (
      <li className="px-4 py-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
          <ImageIcon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white">
            <Link
              href={`/u/${encodeURIComponent(username)}`}
              className="font-medium hover:underline"
            >
              @{username}
            </Link>{" "}
            added a story
          </p>
          {caption && <p className="text-xs text-gray-400 mt-0.5 truncate">"{caption}"</p>}
          <Link
            href={`/feed?story=${encodeURIComponent(username)}`}
            className="text-xs text-purple-400 mt-1 inline-block hover:underline"
          >
            View story · {timeAgo(n.createdAt)}
          </Link>
        </div>
      </li>
    );
  }

  if (n.type === "badge.earned") {
    const iconName = (n.payload.icon as string) ?? "Award";
    const Icon = ICON_MAP[iconName] ?? Award;
    const color = (n.payload.color as string) ?? "bg-blue-500/15 text-blue-300 border-blue-500/30";
    return (
      <li className="px-4 py-3 flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${color}`}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white">
            Badge earned: <span className="font-medium">{n.payload.label as string}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {n.payload.description as string} · {timeAgo(n.createdAt)}
          </p>
        </div>
      </li>
    );
  }
  return (
    <li className="px-4 py-3">
      <p className="text-sm text-gray-300">{n.type}</p>
    </li>
  );
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
