"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") ?? "";
}

export default function SmartAlbumRedirect({ id }: { id: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      router.replace("/gallery");
      return;
    }
    let cancelled = false;
    fetch(`/api/gallery/smart-albums/${id}`, {
      headers: { Authorization: `Bearer ${authToken()}` },
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text().catch(() => "Failed"));
        return r.json();
      })
      .then((album) => {
        if (cancelled) return;
        const f = album.filters || {};
        const params = new URLSearchParams();
        params.set("smart", String(id));
        if (f.tag) params.set("tag", f.tag);
        if (f.year) params.set("year", String(f.year));
        if (f.from) params.set("from", f.from);
        if (f.to) params.set("to", f.to);
        if (f.minRating) params.set("minRating", String(f.minRating));
        if (f.tab === "favorites") params.set("tab", "favorites");
        router.replace(`/gallery?${params.toString()}`);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (error) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-red-300 text-sm">
        Smart album not found.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
      Loading smart album…
    </div>
  );
}
