"use client";

import { useEffect, useState } from "react";
import { Plus, Link2, X } from "lucide-react";

function authHeaders() {
  return {
    Authorization: `Bearer ${
      typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : ""
    }`,
  };
}

type ModalKind = "profile" | "video" | null;

export default function ProfilesAdminButtons() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);

  useEffect(() => {
    fetch("/api/auth/me", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m?.isAdmin) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  if (!isAdmin) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModal("profile")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
        >
          <Plus size={14} /> Add profile
        </button>
        <button
          type="button"
          onClick={() => setModal("video")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Link2 size={14} /> Add from video URL
        </button>
      </div>

      {modal === "profile" && <AddProfileModal onClose={() => setModal(null)} />}
      {modal === "video" && <AddFromVideoModal onClose={() => setModal(null)} />}
    </>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[1300] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 px-4 pb-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-dark-card2"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddProfileModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState("30");
  const [autoPoll, setAutoPoll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setStatus(null);
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setErr("URL required");
      return;
    }
    const body: Record<string, unknown> = {
      url: cleanUrl,
      auto_poll: autoPoll,
    };
    if (limit.trim() === "") {
      body.videos_limit = null;
    } else {
      const n = Number(limit);
      if (!Number.isInteger(n) || n < 1 || n > 1000) {
        setErr("Limit must be 1–1000");
        return;
      }
      body.videos_limit = n;
    }
    setBusy(true);
    setStatus("Resolving uploader…");
    const r = await fetch("/api/clips/profiles/from-url", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setErr(j.error || "Save failed");
      setStatus(null);
      return;
    }
    window.location.href = `/videos/clips/${encodeURIComponent(j.profile)}`;
  }

  return (
    <ModalShell title="Add profile" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[11px] text-gray-500">
          Paste a profile/channel URL. yt-dlp picks up the uploader name and
          uses it as the profile slug.
        </p>
        <Field label="Profile URL">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@someuser"
            autoFocus
            className="w-full bg-dark-card2 border border-dark-border rounded px-2 py-1.5 text-white text-sm"
          />
        </Field>
        <Field label="Videos limit">
          <input
            type="number"
            min={1}
            max={1000}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="30"
            className="w-full bg-dark-card2 border border-dark-border rounded px-2 py-1.5 text-white text-sm"
          />
        </Field>
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={autoPoll}
            onChange={(e) => setAutoPoll(e.target.checked)}
          />
          Auto-poll on sync-all
        </label>
        {status && !err && <p className="text-xs text-blue-300">{status}</p>}
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-dark-border text-gray-300 hover:bg-dark-card2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white disabled:opacity-50"
          >
            {busy ? "Working…" : "Create"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function AddFromVideoModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setStatus(null);
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setErr("URL required");
      return;
    }
    setBusy(true);
    setStatus("Resolving and downloading…");
    const r = await fetch("/api/clips/from-video-url", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ url: cleanUrl }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setErr(j.error || "Failed");
      setStatus(null);
      return;
    }
    window.location.href = `/videos/clips/${encodeURIComponent(j.profile)}`;
  }

  return (
    <ModalShell title="Add video from URL" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[11px] text-gray-500">
          Paste any yt-dlp-supported video URL. The uploader becomes a profile
          (created if missing, with auto-poll off) and just this one video is
          downloaded.
        </p>
        <Field label="Video URL">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@user/video/1234..."
            autoFocus
            className="w-full bg-dark-card2 border border-dark-border rounded px-2 py-1.5 text-white text-sm"
          />
        </Field>
        {status && !err && <p className="text-xs text-blue-300">{status}</p>}
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-dark-border text-gray-300 hover:bg-dark-card2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          >
            {busy ? "Working…" : "Download"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-gray-300">
      <div className="mb-1">{label}</div>
      {children}
    </label>
  );
}
