"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  User,
  KeyRound,
  MessageCircle,
  Newspaper,
  Package,
  Film,
  Flame,
  Instagram as InstagramIcon,
  Library,
  X,
} from "lucide-react";
import type { AuthUser } from "@/lib/useAuthUser";

type FeatureGate = "feed" | "channels" | "chats" | "clips" | "tiktok" | "shorts18" | "photos" | "store";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  color: string;
  matchPaths?: string[];
  feature?: FeatureGate | FeatureGate[];
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home, color: "text-sky-400" },
  { href: "/feed", label: "Social feed", icon: Newspaper, color: "text-pink-400", feature: "feed" },
  {
    href: "/channels",
    label: "Messages",
    icon: MessageCircle,
    color: "text-purple-400",
    matchPaths: ["/channels", "/chats"],
    feature: ["channels", "chats"],
  },
  {
    href: "/videos",
    label: "Shorties",
    icon: Film,
    color: "text-fuchsia-400",
    feature: ["clips", "tiktok"],
  },
  { href: "/shorts18", label: "Shorties Adults", icon: Flame, color: "text-red-400", feature: "shorts18" },
  { href: "/gallery", label: "My photos", icon: Library, color: "text-violet-400" },
  { href: "/store", label: "App store", icon: Package, color: "text-emerald-400", feature: "store" },
  { href: "/profile", label: "My profile", icon: User, color: "text-gray-300" },
  { href: "/users", label: "Members", icon: Users, color: "text-amber-400" },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  user: AuthUser | null;
}

export default function Sidebar({ mobileOpen, onMobileClose, user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col h-[100dvh]
          bg-dark-sidebar border-r border-dark-border
          transition-all duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:z-auto md:h-screen
          w-60 ${collapsed ? "md:w-16" : "md:w-60"}
          flex-shrink-0
        `}
      >
        <div className="flex items-center h-16 px-4 border-b border-dark-border">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex-shrink-0" />
          {!collapsed && (
            <span className="ml-3 font-semibold text-white text-sm truncate">
              Elite
            </span>
          )}
          <button
            onClick={onMobileClose}
            aria-label="Close menu"
            className="ml-auto text-gray-400 hover:text-white md:hidden"
          >
            <X size={16} />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-auto text-gray-400 hover:text-white hidden md:block"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto" aria-label="Primary">
          <ul className="space-y-1 px-2">
            {navItems
              .filter((item) => {
                if (!item.feature) return true;
                if (!user?.features) return true;
                const keys = Array.isArray(item.feature) ? item.feature : [item.feature];
                return keys.some((k) => user.features?.[k]);
              })
              .map(({ href, label, icon: Icon, color, matchPaths }) => {
              const paths = matchPaths ?? [href];
              const active = paths.some(
                (p) =>
                  pathname === p || (p !== "/" && pathname.startsWith(p + "/")),
              );
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onMobileClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-blue-600/20 text-white border border-blue-600/30"
                        : "text-gray-300 hover:text-white hover:bg-dark-card2"
                    }`}
                  >
                    <Icon size={18} className={`flex-shrink-0 ${color}`} />
                    {!collapsed && <span>{label}</span>}
                  </Link>
                </li>
              );
            })}

            {user?.isAdmin && (
              <>
                <li className="pt-4 pb-1 px-3">
                  {!collapsed && (
                    <span className="text-xs text-gray-600 uppercase tracking-wider">
                      Admin
                    </span>
                  )}
                </li>
                <li>
                  <Link
                    href="/admin"
                    onClick={onMobileClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      pathname === "/admin"
                        ? "bg-blue-600/20 text-white border border-blue-600/30"
                        : "text-gray-300 hover:text-white hover:bg-dark-card2"
                    }`}
                  >
                    <KeyRound size={18} className="flex-shrink-0 text-rose-400" />
                    {!collapsed && <span>Invitations</span>}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/instagram"
                    onClick={onMobileClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      pathname.startsWith("/instagram")
                        ? "bg-blue-600/20 text-white border border-blue-600/30"
                        : "text-gray-300 hover:text-white hover:bg-dark-card2"
                    }`}
                  >
                    <InstagramIcon size={18} className="flex-shrink-0 text-pink-400" />
                    {!collapsed && <span>InstaElite</span>}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings"
                    onClick={onMobileClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      pathname === "/settings"
                        ? "bg-blue-600/20 text-white border border-blue-600/30"
                        : "text-gray-300 hover:text-white hover:bg-dark-card2"
                    }`}
                  >
                    <Settings size={18} className="flex-shrink-0 text-orange-400" />
                    {!collapsed && <span>Settings</span>}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        {!collapsed && user && (
          <div className="p-4 border-t border-dark-border">
            <p className="text-xs text-gray-400 truncate">{user.username}</p>
            <p className="text-xs text-gray-600">{user.isAdmin ? "Admin" : "User"}</p>
          </div>
        )}
      </aside>
    </>
  );
}
