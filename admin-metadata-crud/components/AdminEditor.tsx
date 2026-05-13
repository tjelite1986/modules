"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppEntry } from "@/lib/store";
import Link from "next/link";
import { ArrowLeft, Upload, Trash2, Image as ImageIcon, Save } from "lucide-react";

export function AdminEditor({ entry }: { entry: AppEntry }) {
  const router = useRouter();
  const [name, setName] = useState(entry.meta.name || "");
  const [developer, setDeveloper] = useState(entry.meta.developer || "");
  const [category, setCategory] = useState(entry.meta.category || "");
  const [tagline, setTagline] = useState(entry.meta.tagline || "");
  const [description, setDescription] = useState(entry.meta.description || "");
  const [website, setWebsite] = useState(entry.meta.website || "");
  const [tags, setTags] = useState((entry.meta.tags || []).join(", "));
  const [body, setBody] = useState(entry.meta.body || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/admin/${entry.type}/${encodeURIComponent(entry.slug)}/info`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        developer: developer || undefined,
        category: category || undefined,
        tagline: tagline || undefined,
        description: description || undefined,
        website: website || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        body,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("Saved.");
      router.refresh();
    } else {
      setMessage("Save failed.");
    }
  }

  async function uploadLogo(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/${entry.type}/${encodeURIComponent(entry.slug)}/logo`, {
      method: "POST",
      body: fd,
    });
    if (res.ok) router.refresh();
    else setMessage("Failed to upload logo.");
  }

  async function uploadBanner(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/${entry.type}/${encodeURIComponent(entry.slug)}/banner`, {
      method: "POST",
      body: fd,
    });
    if (res.ok) router.refresh();
    else setMessage("Failed to upload banner.");
  }

  async function deleteBanner() {
    if (!confirm("Remove banner image?")) return;
    const res = await fetch(`/api/admin/${entry.type}/${encodeURIComponent(entry.slug)}/banner`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function uploadScreenshot(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/${entry.type}/${encodeURIComponent(entry.slug)}/screenshot`, {
      method: "POST",
      body: fd,
    });
    if (res.ok) router.refresh();
    else setMessage("Failed to upload screenshot.");
  }

  async function deleteScreenshot(file: string) {
    if (!confirm(`Delete ${file}?`)) return;
    const res = await fetch(`/api/admin/${entry.type}/${encodeURIComponent(entry.slug)}/screenshot/${encodeURIComponent(file)}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  const logoUrl = entry.hasLogo ? `/api/asset/${entry.type}/${encodeURIComponent(entry.slug)}/logo?t=${Date.now()}` : null;
  const bannerUrl = entry.hasBanner ? `/api/asset/${entry.type}/${encodeURIComponent(entry.slug)}/banner?t=${Date.now()}` : null;

  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <h1 className="text-2xl font-bold mb-1">{entry.meta.name}</h1>
      <p className="text-sm text-zinc-500 mb-6">
        {entry.type}/{entry.slug} · {entry.versions.length} version{entry.versions.length === 1 ? "" : "s"}
      </p>

      <section className="bg-zinc-900 border border-zinc-800/50 rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          Logo
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-zinc-800 shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                No logo
              </div>
            )}
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-2 text-sm transition">
            <Upload className="w-4 h-4" />
            Upload logo (PNG/JPG/WebP)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo(f);
              }}
            />
          </label>
        </div>
      </section>

      <section className="bg-zinc-900 border border-zinc-800/50 rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          Banner (16:9, recommended 1024x500)
        </h2>
        <div className="flex flex-col gap-3">
          <div className="aspect-[16/9] w-full max-w-md rounded-xl overflow-hidden bg-zinc-800">
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                No banner
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <label className="inline-flex items-center gap-2 cursor-pointer bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-2 text-sm transition">
              <Upload className="w-4 h-4" />
              {bannerUrl ? "Replace banner" : "Upload banner"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadBanner(f);
                }}
              />
            </label>
            {bannerUrl && (
              <button
                type="button"
                onClick={deleteBanner}
                className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-2 text-sm transition text-zinc-300"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="bg-zinc-900 border border-zinc-800/50 rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-3">Screenshots</h2>
        {entry.screenshots.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-3">
            {entry.screenshots.map((f) => (
              <div key={f} className="relative shrink-0 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/asset/${entry.type}/${encodeURIComponent(entry.slug)}/screenshots/${encodeURIComponent(f)}`}
                  alt=""
                  className="h-32 w-auto rounded-lg"
                />
                <button
                  onClick={() => deleteScreenshot(f)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="inline-flex items-center gap-2 cursor-pointer bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-2 text-sm transition">
          <Upload className="w-4 h-4" />
          Add screenshot
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadScreenshot(f);
            }}
          />
        </label>
      </section>

      <form onSubmit={saveInfo} className="bg-zinc-900 border border-zinc-800/50 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold mb-1">Info (info.md)</h2>
        <Field label="Name" value={name} onChange={setName} required />
        <Field label="Developer" value={developer} onChange={setDeveloper} />
        <Field label="Category" value={category} onChange={setCategory} placeholder="e.g. Entertainment" />
        <Field label="Tagline" value={tagline} onChange={setTagline} placeholder="Short one-liner" />
        <Field label="Short description" value={description} onChange={setDescription} placeholder="Shown in card views" textarea />
        <Field label="Website" value={website} onChange={setWebsite} placeholder="https://..." />
        <Field label="Tags" value={tags} onChange={setTags} placeholder="comma-separated, e.g. video, social" />
        <Field label="Long description (markdown)" value={body} onChange={setBody} textarea rows={10} />

        {message && <div className="text-sm text-zinc-300 bg-zinc-800 rounded px-3 py-2">{message}</div>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-5 py-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  rows,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows ?? 3}
          className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition resize-y"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition"
        />
      )}
    </label>
  );
}
