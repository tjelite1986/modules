"use client";

import { Search, LogOut, ChevronDown, Menu, User, Sun, Moon } from "lucide-react";
import Link from "next/link";
import NotificationsBell from "./NotificationsBell";
import { useTheme } from "@/lib/useTheme";
import { useState } from "react";
import type { AuthUser } from "@/lib/useAuthUser";
import { useSocket } from "@/lib/socket";
import { usePresence, type PresenceStatus } from "@/hooks/usePresence";

interface TopBarProps {
  onMenuClick: () => void;
  user: AuthUser | null;
  onLogout: () => void;
}

const STATUS_OPTIONS: { value: PresenceStatus; label: string; color: string }[] = [
  { value: "online", label: "Online", color: "bg-emerald-400" },
  { value: "away", label: "Away", color: "bg-amber-400" },
  { value: "dnd", label: "Do not disturb", color: "bg-red-400" },
];

export default function TopBar({ onMenuClick, user, onLogout }: TopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [myStatus, setMyStatusLocal] = useState<PresenceStatus>("online");
  const [statusText, setStatusText] = useState("");
  const socket = useSocket();
  const { setMyStatus } = usePresence(socket);
  const { theme, toggle: toggleTheme } = useTheme();

  function changeStatus(s: PresenceStatus) {
    setMyStatusLocal(s);
    setMyStatus(s, statusText || undefined);
  }

  function commitStatusText() {
    setMyStatus(myStatus, statusText || undefined);
  }

  const myStatusColor = STATUS_OPTIONS.find((o) => o.value === myStatus)?.color ?? "bg-gray-500";

  const initials =
    user?.username
      ?.split(/[\s._-]+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";

  return (
    <header className="h-16 bg-dark-sidebar border-b border-dark-border flex items-center px-4 md:px-6 gap-3">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="md:hidden p-2 text-sky-400 hover:text-sky-300 rounded-lg hover:bg-dark-card transition-colors flex-shrink-0"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 max-w-md relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search..."
          aria-label="Search"
          className="w-full bg-dark-input border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-dark-card"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <NotificationsBell />

        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-label="Account menu"
            aria-expanded={dropdownOpen}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-dark-card transition-colors"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                {initials}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-dark-sidebar ${myStatusColor}`} />
            </div>
            <span className="text-sm text-gray-300 hidden sm:block">{user?.username}</span>
            <ChevronDown size={14} className="text-gray-500" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-56 bg-dark-card2 border border-dark-border rounded-lg shadow-xl z-20">
                <div className="px-4 py-3 border-b border-dark-border">
                  <p className="text-sm font-medium text-white truncate" data-pii>{user?.username}</p>
                  <p className="text-xs text-gray-500 truncate" data-pii>{user?.email ?? "no email"}</p>
                </div>
                {user && (
                  <Link
                    href={`/u/${encodeURIComponent(user.username)}`}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-dark-card transition-colors border-b border-dark-border"
                  >
                    <User size={14} className="text-gray-300" />
                    View profile
                  </Link>
                )}
                <div className="px-2 py-2 border-b border-dark-border">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-1">Status</p>
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => changeStatus(opt.value)}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${
                        myStatus === opt.value
                          ? "bg-blue-600/20 text-blue-300"
                          : "text-gray-300 hover:bg-dark-card"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                      {opt.label}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={statusText}
                    onChange={(e) => setStatusText(e.target.value)}
                    onBlur={commitStatusText}
                    onKeyDown={(e) => e.key === "Enter" && commitStatusText()}
                    placeholder="What's up?"
                    maxLength={80}
                    className="mt-2 w-full bg-dark-input border border-dark-border rounded-md px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-dark-card transition-colors border-b border-dark-border"
                >
                  {theme === "dark" ? (
                    <Sun size={14} className="text-amber-400" />
                  ) : (
                    <Moon size={14} className="text-indigo-400" />
                  )}
                  Switch to {theme === "dark" ? "light" : "dark"} theme
                </button>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={14} className="text-red-400" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
