"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import PrivacyControls from "./PrivacyControls";
import { useAuthUser } from "@/lib/useAuthUser";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading, logout } = useAuthUser();

  // Track visual viewport so the layout shrinks when the on-screen keyboard appears.
  // visualViewport.height = visible area excluding the soft keyboard. iOS Safari and
  // mobile Chrome both expose this; if absent we fall back to 100dvh.
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty("--vvh", `${vv.height}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-bg text-gray-500 text-sm">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      className="flex bg-dark-bg overflow-hidden"
      style={{ height: "var(--vvh, 100dvh)" }}
    >
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        user={user}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          onMenuClick={() => setMobileOpen(true)}
          user={user}
          onLogout={logout}
        />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 relative">{children}</main>
      </div>
      <PrivacyControls />
    </div>
  );
}
