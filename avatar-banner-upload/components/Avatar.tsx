"use client";

import { useState } from "react";

interface Props {
  username: string | null | undefined;
  size?: number;
  className?: string;
  /** Override the avatar URL — useful for cache-busting via ?v=mtime */
  url?: string | null;
  /** Hide the gradient background and show only the image (no fallback) */
  noFallback?: boolean;
}

const GRADIENTS = [
  "from-pink-500 to-purple-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-violet-500 to-fuchsia-500",
  "from-rose-500 to-red-500",
  "from-indigo-500 to-blue-500",
  "from-lime-500 to-emerald-500",
];

export default function Avatar({ username, size = 32, url, className, noFallback }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = (username ?? "?")
    .split(/[\s._-]+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const idx = (username ?? "?").charCodeAt(0) % GRADIENTS.length;
  const gradient = GRADIENTS[idx];
  const src = url !== undefined ? url : username ? `/api/avatars/${encodeURIComponent(username)}` : null;

  const fontSize = Math.max(10, Math.round(size * 0.36));

  return (
    <div
      className={`rounded-full overflow-hidden bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-semibold flex-shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size, fontSize }}
    >
      {src && !imgFailed ? (
        <img
          src={src}
          alt={username ?? ""}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : noFallback ? null : (
        <span>{initials}</span>
      )}
    </div>
  );
}
