"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Settings, Gamepad2, AppWindow, Home } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

const desktopNav = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/apps", label: "Apps", icon: AppWindow, match: (p: string) => p.startsWith("/apps") || p.startsWith("/app/") },
  { href: "/games", label: "Games", icon: Gamepad2, match: (p: string) => p.startsWith("/games") || p.startsWith("/game/") },
];

function avatarColor(name: string): string {
  const palette = ["bg-emerald-600", "bg-sky-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function Header({ brand = "Catalog" }: { brand?: string }) {
  const pathname = usePathname();
  const { data } = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");
  const isAdmin = data?.user?.role === "admin";
  const username = data?.user?.name || "?";
  const initial = username.charAt(0).toUpperCase();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-lg tracking-tight">{brand}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-3">
          {desktopNav.map((it) => {
            const active = it.match(pathname || "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition",
                  active ? "bg-indigo-500/15 text-indigo-400" : "text-zinc-400 hover:text-white hover:bg-zinc-900",
                )}
              >
                <Icon className="w-4 h-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <form onSubmit={onSubmit} className="flex-1 max-w-xl ml-auto md:ml-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder="Search apps and games"
              className="w-full bg-zinc-900 border border-zinc-800/60 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500/60 transition"
            />
          </div>
        </form>

        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <Link
              href="/admin"
              className={clsx(
                "p-2 rounded-full transition",
                pathname?.startsWith("/admin")
                  ? "text-indigo-400 bg-indigo-500/15"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900",
              )}
              title="Admin"
            >
              <Settings className="w-5 h-5" />
            </Link>
          )}
          <Link
            href="/account"
            className={clsx(
              "w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm transition",
              avatarColor(username),
            )}
            title={username}
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}
