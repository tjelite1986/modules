"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings, X } from "lucide-react";
import { useAuthUser } from "@/lib/useAuthUser";
import { encodeSlugForUrl } from "@/lib/clipSlugs";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}` };
}

interface ClipProfile {
  name: string;
  displayName: string | null;
  sourceUrl: string | null;
  sourceKind: string | null;
  autoPoll: boolean;
  videosLimit: number | null;
  lastSyncedAt: string | null;
}

interface ClipRow {
  slug: string;
  basename: string;
  title: string;
  posterMtime: number;
  hasPoster: boolean;
}

interface Candidate {
  video_id: string;
  url: string;
  title: string | null;
  duration: number | null;
  upload_date: string | null;
  thumbnail: string | null;
  has_local: boolean;
  skipped: boolean;
}

interface Props {
  profileName: string;
  clipsOnDisk: ClipRow[];
}

export default function ProfileAdminPanel({ profileName, clipsOnDisk }: Props) {
  const { user } = useAuthUser(false);
  const [profile, setProfile] = useState<ClipProfile | null>(null);
  const [draftLimit, setDraftLimit] = useState("");
  const [draftSourceUrl, setDraftSourceUrl] = useState("");
  const [autoPoll, setAutoPoll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refreshProfile = useCallback(async () => {
    const r = await fetch(`/api/clips/profiles`, { headers: authHeaders() });
    if (!r.ok) return;
    const data = (await r.json()) as { profiles: ClipProfile[] };
    const p = data.profiles.find((x) => x.name === profileName) || null;
    setProfile(p);
    setDraftLimit(p?.videosLimit == null ? "" : String(p.videosLimit));
    setDraftSourceUrl(p?.sourceUrl ?? "");
    setAutoPoll(!!p?.autoPoll);
  }, [profileName]);

  const loadCandidates = useCallback(async () => {
    setCandidatesLoading(true);
    setErrMsg(null);
    const r = await fetch(
      `/api/clips/profiles/${encodeURIComponent(profileName)}/candidates?limit=200`,
      { headers: authHeaders() },
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErrMsg(j.error || "Fetch failed");
      setCandidates([]);
    } else {
      setCandidates(j.entries ?? []);
    }
    setCandidatesLoading(false);
  }, [profileName]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  if (!user?.isAdmin) return null;

  const saveProfile = async () => {
    setSaving(true);
    setErrMsg(null);
    setStatusMsg(null);
    const body: Record<string, unknown> = {
      name: profileName,
      auto_poll: autoPoll,
      source_url: draftSourceUrl.trim() || null,
    };
    if (draftLimit.trim() === "") {
      body.videos_limit = null;
    } else {
      const n = Number(draftLimit);
      if (!Number.isInteger(n) || n < 1 || n > 1000) {
        setErrMsg("Limit must be 1–1000");
        setSaving(false);
        return;
      }
      body.videos_limit = n;
    }
    const r = await fetch(`/api/clips/profiles`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErrMsg(j.error || "Save failed");
    } else {
      setStatusMsg("Saved");
      refreshProfile();
    }
    setSaving(false);
  };

  const triggerSync = async () => {
    setSyncing(true);
    setErrMsg(null);
    setStatusMsg(null);
    const r = await fetch(`/api/clips/profiles/${encodeURIComponent(profileName)}/sync`, {
      method: "POST",
      headers: authHeaders(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErrMsg(j.error || "Sync failed");
    } else {
      setStatusMsg(`Sync done: +${j.added ?? 0} new, ${j.skipped ?? 0} skipped${j.errors?.length ? `, ${j.errors.length} errors` : ""}`);
      refreshProfile();
      if (candidatesOpen) loadCandidates();
    }
    setSyncing(false);
  };

  const toggleCandidates = () => {
    const next = !candidatesOpen;
    setCandidatesOpen(next);
    if (next && candidates === null) loadCandidates();
  };

  const downloadOne = async (c: Candidate) => {
    setDownloading((prev) => new Set(prev).add(c.video_id));
    const r = await fetch(
      `/api/clips/profiles/${encodeURIComponent(profileName)}/download`,
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: c.video_id, url: c.url }),
      },
    );
    if (r.ok) {
      setCandidates((prev) =>
        prev ? prev.map((x) => (x.video_id === c.video_id ? { ...x, has_local: true, skipped: false } : x)) : prev,
      );
    } else {
      const j = await r.json().catch(() => ({}));
      setErrMsg(j.error || "Download failed");
    }
    setDownloading((prev) => {
      const next = new Set(prev);
      next.delete(c.video_id);
      return next;
    });
  };

  const deleteClip = async (slug: string) => {
    if (!confirm(`Delete this clip and replace it with a new one?\n${slug}`)) return;
    setDeletingSlug(slug);
    const r = await fetch(`/api/clips/${encodeURIComponent(encodeSlugForUrl(slug))}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErrMsg(j.error || "Delete failed");
    } else {
      setStatusMsg(
        j.topUp
          ? `Deleted. Top-up: +${j.topUp.added} new`
          : "Deleted.",
      );
      // Reload the surrounding page so the clip grid below reflects the change.
      window.location.reload();
    }
    setDeletingSlug(null);
  };

  return (
    <>
      {/* Floating gear stacked just above the privacy/screenshot pill
          (which sits at bottom-3 right-3 z-[1100] inside DashboardShell).
          ClipsClient renders the grid as `absolute inset-0`, so the button
          and drawer have to live on top of everything else. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close profile admin" : "Open profile admin"}
        className="fixed bottom-16 right-3 z-[1200] w-11 h-11 flex items-center justify-center rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg ring-1 ring-black/40"
        title={open ? "Close profile admin" : "Open profile admin"}
      >
        {open ? <X size={18} /> : <Settings size={18} />}
      </button>

      {!open ? null : (
        <div
          className="fixed inset-0 z-[1150] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-14 px-4 pb-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-5xl space-y-3">
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">
            Profile admin: <span className="text-fuchsia-300">{profileName}</span>
          </h2>
          {profile?.lastSyncedAt && (
            <span className="text-[11px] text-gray-500">
              last synced {new Date(profile.lastSyncedAt + "Z").toLocaleString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-gray-300">
            <div className="mb-1">Source URL</div>
            <input
              type="text"
              value={draftSourceUrl}
              onChange={(e) => setDraftSourceUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@username"
              className="w-full bg-dark-card2 border border-dark-border rounded px-2 py-1 text-white text-xs"
            />
          </label>
          <label className="text-xs text-gray-300">
            <div className="mb-1">
              Videos limit
              <span className="text-gray-500 ml-1">(empty = default 30)</span>
            </div>
            <input
              type="number"
              min={1}
              max={1000}
              value={draftLimit}
              onChange={(e) => setDraftLimit(e.target.value)}
              placeholder="30"
              className="w-full bg-dark-card2 border border-dark-border rounded px-2 py-1 text-white text-xs"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-xs text-gray-300 flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoPoll}
              onChange={(e) => setAutoPoll(e.target.checked)}
            />
            Auto poll on sync-all
          </label>
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={triggerSync}
            disabled={syncing || !profile?.sourceUrl}
            title={profile?.sourceUrl ? "Pull new videos up to limit" : "Set a source URL first"}
            className="px-3 py-1 text-xs rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            onClick={toggleCandidates}
            disabled={!profile?.sourceUrl}
            className="px-3 py-1 text-xs rounded border border-dark-border text-white hover:bg-dark-card2 disabled:opacity-50"
          >
            {candidatesOpen ? "Hide available" : "Browse available"}
          </button>
          {statusMsg && <span className="text-[11px] text-green-400">{statusMsg}</span>}
          {errMsg && <span className="text-[11px] text-red-400">{errMsg}</span>}
        </div>
      </div>

      {candidatesOpen && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-white">Available from source</h3>
            <button
              type="button"
              onClick={loadCandidates}
              disabled={candidatesLoading}
              className="text-[11px] text-blue-400 hover:underline"
            >
              {candidatesLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          {candidates === null && candidatesLoading && (
            <div className="text-[11px] text-gray-500 py-4">Polling source…</div>
          )}
          {candidates && candidates.length === 0 && (
            <div className="text-[11px] text-gray-500 py-4">No entries returned.</div>
          )}
          {candidates && candidates.length > 0 && (
            <ul className="divide-y divide-dark-border max-h-[60vh] overflow-y-auto">
              {candidates.map((c) => (
                <li
                  key={c.video_id}
                  className="flex items-center gap-3 py-2 px-1"
                >
                  {c.thumbnail ? (
                    <img
                      src={c.thumbnail}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-14 h-20 object-cover rounded bg-black flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-20 rounded bg-dark-card2 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-200 truncate" title={c.title ?? ""}>
                      {c.title || <em className="text-gray-600">(no title)</em>}
                    </div>
                    <div className="font-mono text-[10px] text-gray-500 truncate" title={c.video_id}>
                      {c.video_id}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500 w-14 text-right tabular-nums">
                    {c.duration ? `${c.duration}s` : ""}
                  </span>
                  {c.has_local ? (
                    <span className="text-[10px] text-green-500 w-20 text-right">On disk</span>
                  ) : c.skipped ? (
                    <button
                      type="button"
                      onClick={() => downloadOne(c)}
                      disabled={downloading.has(c.video_id)}
                      className="text-[10px] px-2 py-0.5 rounded bg-amber-700 hover:bg-amber-600 text-white w-20 text-center"
                      title="Previously deleted — download again"
                    >
                      {downloading.has(c.video_id) ? "…" : "Re-add"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => downloadOne(c)}
                      disabled={downloading.has(c.video_id)}
                      className="text-[10px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white w-20 text-center"
                    >
                      {downloading.has(c.video_id) ? "…" : "Download"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {clipsOnDisk.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-3">
          <h3 className="text-xs font-semibold text-white mb-2">
            On disk ({clipsOnDisk.length})
          </h3>
          <ul className="divide-y divide-dark-border max-h-[60vh] overflow-y-auto">
            {clipsOnDisk.map((c) => (
              <li key={c.slug} className="flex items-center gap-3 py-1.5 px-1">
                {c.hasPoster ? (
                  <img
                    src={`/api/clips/${encodeURIComponent(encodeSlugForUrl(c.slug))}/poster?v=${Math.floor(c.posterMtime)}`}
                    alt=""
                    loading="lazy"
                    className="w-14 h-20 object-cover rounded bg-black flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-20 rounded bg-dark-card2 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-200 truncate" title={c.title}>
                    {c.title}
                  </div>
                  <div className="font-mono text-[10px] text-gray-500 truncate" title={c.basename}>
                    {c.basename}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteClip(c.slug)}
                  disabled={deletingSlug === c.slug}
                  className="text-[10px] px-2 py-0.5 rounded bg-red-700 hover:bg-red-600 text-white w-20 text-center disabled:opacity-50"
                >
                  {deletingSlug === c.slug ? "…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
          </div>
        </div>
      )}
    </>
  );
}
