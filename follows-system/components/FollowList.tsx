"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";

interface UserItem {
  id: number;
  username: string;
  avatar: string | null;
}

export default function FollowList({ kind }: { kind: "followers" | "following" }) {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${encodeURIComponent(username)}/${kind}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setLoading(false);
      });
  }, [username, kind]);

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <Link href={`/u/${encodeURIComponent(username)}`} className="text-sm text-gray-500 hover:text-white">
            ← @{username}
          </Link>
          <h1 className="text-2xl font-semibold text-white mt-2 capitalize">{kind}</h1>
          <p className="text-sm text-gray-500 mt-1">{items.length} {kind === "followers" ? "follower(s)" : "user(s) followed"}</p>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading...</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-gray-500">No {kind} yet.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((u) => (
            <Link
              key={u.id}
              href={`/u/${encodeURIComponent(u.username)}`}
              className="bg-dark-card hover:bg-dark-card2 border border-dark-border rounded-xl p-4 flex items-center gap-3 transition-colors"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {u.avatar ? (
                  <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  u.username.slice(0, 2).toUpperCase()
                )}
              </div>
              <p className="text-sm text-white truncate">@{u.username}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
