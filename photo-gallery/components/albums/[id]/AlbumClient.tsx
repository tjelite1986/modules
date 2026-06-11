"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpAZ,
  CheckSquare,
  Copy,
  Download,
  GripVertical,
  ImagePlus,
  Loader2,
  Move,
  Pencil,
  Play,
  Share2,
  Square,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Lightbox from "../../Lightbox";
import AddPhotosPickerModal from "../../AddPhotosPickerModal";
import {
  thumbUrl,
  previewUrl,
  originalUrl,
} from "../../GalleryClient";
import type { AlbumWithCounts, GalleryItem } from "../../types";
import { mediaToken } from "@/lib/mediaToken";

function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") ?? "";
}

function authHeaders() {
  return { Authorization: `Bearer ${authToken()}` };
}

function fileUrlForLightbox(item: GalleryItem, variant: "preview" | "file") {
  return variant === "preview" ? previewUrl(item) : originalUrl(item);
}

export default function AlbumClient({ albumId }: { albumId: number }) {
  const router = useRouter();
  const [album, setAlbum] = useState<AlbumWithCounts | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingName, setEditingName] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [showBulkTag, setShowBulkTag] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");
  const [bulkTagBusy, setBulkTagBusy] = useState(false);
  const [bulkTagError, setBulkTagError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "custom">("desc");
  const [reordering, setReordering] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(`album_sort_${albumId}`);
    if (stored === "asc" || stored === "desc" || stored === "custom") {
      setSortOrder(stored);
    }
  }, [albumId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`album_sort_${albumId}`, sortOrder);
  }, [albumId, sortOrder]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/gallery/tags", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setAllTags((data.tags || []).map((t: { tag: string }) => t.tag));
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, iRes] = await Promise.all([
        fetch(`/api/gallery/albums/${albumId}`, {
          headers: authHeaders(),
          cache: "no-store",
        }),
        fetch(
          `/api/gallery/items?albumId=${albumId}&limit=200&order=${sortOrder}`,
          {
            headers: authHeaders(),
            cache: "no-store",
          },
        ),
      ]);
      if (aRes.ok) setAlbum(await aRes.json());
      if (iRes.ok) {
        const data = await iRes.json();
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [albumId, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  const updateItemInPlace = (updated: GalleryItem) => {
    setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const removeItemFromList = (id: number) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const onToggleFavorite = async (item: GalleryItem) => {
    const next = item.is_favorite === 1 ? false : true;
    const res = await fetch(`/api/gallery/items/${item.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: next }),
    });
    if (res.ok) updateItemInPlace(await res.json());
  };

  const onSoftDelete = async (item: GalleryItem) => {
    const res = await fetch(`/api/gallery/items/${item.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      removeItemFromList(item.id);
      if (lightboxIndex !== null && lightboxIndex >= items.length - 1) {
        setLightboxIndex(null);
      }
    }
  };

  const removeFromAlbum = async (ids: number[]) => {
    await fetch(`/api/gallery/albums/${albumId}/items`, {
      method: "DELETE",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: ids }),
    });
    setItems((prev) => prev.filter((p) => !ids.includes(p.id)));
    setSelected(new Set());
    setSelecting(false);
  };

  const bulkFavorite = async (favorite: boolean) => {
    const ids = Array.from(selected);
    for (const id of ids) {
      const res = await fetch(`/api/gallery/items/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: favorite }),
      });
      if (res.ok) updateItemInPlace(await res.json());
    }
    setSelected(new Set());
    setSelecting(false);
  };

  const bulkSoftDelete = async () => {
    const ids = Array.from(selected);
    for (const id of ids) {
      const res = await fetch(`/api/gallery/items/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) removeItemFromList(id);
    }
    setSelected(new Set());
    setSelecting(false);
  };

  const submitBulkTag = async () => {
    const tag = bulkTagValue.trim();
    if (!tag || bulkTagBusy) return;
    setBulkTagBusy(true);
    setBulkTagError(null);
    const res = await fetch("/api/gallery/tags", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ tag, itemIds: Array.from(selected) }),
    });
    setBulkTagBusy(false);
    if (res.ok) {
      setShowBulkTag(false);
      setBulkTagValue("");
      setSelected(new Set());
      setSelecting(false);
      const tagsRes = await fetch("/api/gallery/tags", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setAllTags((data.tags || []).map((t: { tag: string }) => t.tag));
      }
    } else {
      setBulkTagError("Invalid tag (letters, digits, space, dash, underscore)");
    }
  };

  const deleteAlbum = async () => {
    if (!confirm("Delete this album? Photos in it will not be deleted.")) return;
    const res = await fetch(`/api/gallery/albums/${albumId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) router.push("/gallery");
  };

  const renameAlbum = async () => {
    const next = renameValue.trim();
    if (!next || !album) return;
    const res = await fetch(`/api/gallery/albums/${albumId}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    if (res.ok) {
      setAlbum(await res.json());
      setEditingName(false);
    }
  };

  const saveDescription = async () => {
    const next = descValue.trim();
    const res = await fetch(`/api/gallery/albums/${albumId}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ description: next ? next : null }),
    });
    if (res.ok) {
      setAlbum(await res.json());
      setEditingDesc(false);
    }
  };

  if (loading && !album) {
    return (
      <div className="text-gray-400 text-sm flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!album) {
    return (
      <div className="rounded-md border border-gray-800 p-8 text-center text-gray-400 text-sm">
        Album not found.{" "}
        <Link href="/gallery" className="text-violet-300 underline">
          Back to gallery
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/gallery"
          className="p-1.5 rounded hover:bg-gray-800 text-gray-300"
          aria-label="Back to gallery"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") renameAlbum();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
            />
            <button
              onClick={renameAlbum}
              className="px-2 py-1 text-sm bg-violet-600 rounded hover:bg-violet-500 text-white"
            >
              Save
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="px-2 py-1 text-sm text-gray-300 hover:bg-gray-800 rounded"
            >
              Cancel
            </button>
          </div>
        ) : (
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            {album.name}
            <button
              onClick={() => {
                setRenameValue(album.name);
                setEditingName(true);
              }}
              className="p-1 rounded hover:bg-gray-800 text-gray-400"
              aria-label="Rename"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </h1>
        )}
        <div className="text-sm text-gray-400 ml-2">{items.length} items</div>
        <div className="flex-1" />
        <button
          onClick={() =>
            setSortOrder((s) => {
              if (s === "desc") return "asc";
              if (s === "asc") return "custom";
              return "desc";
            })
          }
          className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-700 text-gray-200 hover:border-gray-500 text-sm flex items-center gap-1"
          title="Toggle sort: Newest → Oldest → Custom"
        >
          {sortOrder === "desc" ? (
            <>
              <ArrowDownAZ className="w-4 h-4" /> Newest
            </>
          ) : sortOrder === "asc" ? (
            <>
              <ArrowUpAZ className="w-4 h-4" /> Oldest
            </>
          ) : (
            <>
              <Move className="w-4 h-4" /> Custom
            </>
          )}
        </button>
        {sortOrder === "custom" && (
          <button
            onClick={() => {
              setReordering((r) => !r);
              if (selecting) {
                setSelecting(false);
                setSelected(new Set());
              }
            }}
            className={`px-3 py-1.5 rounded-md text-sm border ${
              reordering
                ? "bg-emerald-600 border-emerald-500 text-white"
                : "bg-gray-900 border-gray-700 text-gray-200 hover:border-gray-500"
            }`}
            title={reordering ? "Done reordering" : "Drag items to reorder"}
          >
            <GripVertical className="w-4 h-4 inline-block mr-1" />
            {reordering ? (savingOrder ? "Saving…" : "Done") : "Reorder"}
          </button>
        )}
        <button
          onClick={() => setShowAddPhotos(true)}
          className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-sm text-white flex items-center gap-1"
        >
          <ImagePlus className="w-4 h-4" /> Add photos
        </button>
        <button
          onClick={() => setShowShare(true)}
          className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-700 text-gray-200 hover:border-gray-500 text-sm flex items-center gap-1"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
        <button
          onClick={() => {
            setSelecting((v) => !v);
            setSelected(new Set());
          }}
          className={`px-3 py-1.5 rounded-md text-sm border ${
            selecting
              ? "bg-violet-600 border-violet-500 text-white"
              : "bg-gray-900 border-gray-700 text-gray-200 hover:border-gray-500"
          }`}
        >
          <CheckSquare className="w-4 h-4 inline-block mr-1" />
          {selecting ? "Done" : "Select"}
        </button>
        <button
          onClick={deleteAlbum}
          className="px-3 py-1.5 rounded-md bg-red-600/20 text-red-300 border border-red-600/40 text-sm hover:bg-red-600/30 flex items-center gap-1"
        >
          <Trash2 className="w-4 h-4" /> Delete album
        </button>
      </div>

      {editingDesc ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <textarea
            autoFocus
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingDesc(false);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveDescription();
            }}
            placeholder="Add a description for this album…"
            rows={2}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-violet-400 resize-none"
          />
          <div className="flex gap-1">
            <button
              onClick={saveDescription}
              className="px-3 py-1.5 rounded-md text-sm bg-violet-600 hover:bg-violet-500 text-white"
            >
              Save
            </button>
            <button
              onClick={() => setEditingDesc(false)}
              className="px-3 py-1.5 rounded-md text-sm text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : album.description ? (
        <button
          onClick={() => {
            setDescValue(album.description || "");
            setEditingDesc(true);
          }}
          className="text-left text-sm text-gray-300 hover:text-white whitespace-pre-wrap rounded-md hover:bg-gray-900 px-2 py-1 -mx-2"
          title="Edit description"
        >
          {album.description}
        </button>
      ) : (
        <button
          onClick={() => {
            setDescValue("");
            setEditingDesc(true);
          }}
          className="text-left text-xs text-gray-500 hover:text-gray-300 italic"
        >
          + Add description
        </button>
      )}

      {selecting && selected.size > 0 && (
        <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-md px-3 py-2 flex flex-wrap items-center gap-2 text-sm text-white">
          <span>{selected.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => bulkFavorite(true)}
            className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
          >
            <Star className="w-4 h-4 inline mr-1" /> Favorite
          </button>
          <button
            onClick={() => setShowBulkTag(true)}
            className="px-2 py-1 rounded bg-sky-500/20 text-sky-200 hover:bg-sky-500/30"
          >
            <Tag className="w-4 h-4 inline mr-1" /> Add tag
          </button>
          <a
            href={`/api/gallery/download?ids=${Array.from(selected).join(
              ",",
            )}&t=${encodeURIComponent(mediaToken())}`}
            className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 flex items-center"
          >
            <Download className="w-4 h-4 inline mr-1" /> Download
          </a>
          <button
            onClick={() => removeFromAlbum(Array.from(selected))}
            className="px-2 py-1 rounded bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
          >
            Remove from album
          </button>
          <button
            onClick={bulkSoftDelete}
            className="px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
          >
            <Trash2 className="w-4 h-4 inline mr-1" /> Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-2 py-1 rounded hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border-2 border-dashed border-gray-700 p-12 text-center space-y-3">
          <ImagePlus className="w-12 h-12 text-violet-300 mx-auto" />
          <div className="text-gray-300 text-sm">This album is empty.</div>
          <button
            onClick={() => setShowAddPhotos(true)}
            className="px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-sm inline-flex items-center gap-1.5"
          >
            <ImagePlus className="w-4 h-4" /> Add photos to this album
          </button>
        </div>
      ) : (
        <>
          {reordering && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200 flex items-center justify-between gap-2">
              <span>
                <GripVertical className="w-3.5 h-3.5 inline mr-1" />
                Drag tiles to reorder. Order saves automatically when you drop.
              </span>
              <button
                onClick={async () => {
                  if (!confirm("Reset to default sort and clear custom order?")) return;
                  await fetch(`/api/gallery/albums/${albumId}/reorder`, {
                    method: "POST",
                    headers: { ...authHeaders(), "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "clear" }),
                  });
                  setSortOrder("desc");
                  setReordering(false);
                  load();
                }}
                className="text-emerald-200 hover:text-white underline-offset-2 hover:underline"
              >
                Clear custom order
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
            {items.map((it, idx) => {
              const isSelected = selected.has(it.id);
              const isDragging = dragIndex === idx;
              const isDropTarget = reordering && dropIndex === idx && dragIndex !== null && dragIndex !== idx;
              return (
                <button
                  key={it.id}
                  draggable={reordering}
                  onDragStart={(e) => {
                    if (!reordering) return;
                    setDragIndex(idx);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(idx));
                  }}
                  onDragOver={(e) => {
                    if (!reordering || dragIndex === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dropIndex !== idx) setDropIndex(idx);
                  }}
                  onDragLeave={() => {
                    if (dropIndex === idx) setDropIndex(null);
                  }}
                  onDrop={async (e) => {
                    if (!reordering || dragIndex === null) return;
                    e.preventDefault();
                    const from = dragIndex;
                    const to = idx;
                    setDragIndex(null);
                    setDropIndex(null);
                    if (from === to) return;
                    const next = items.slice();
                    const [moved] = next.splice(from, 1);
                    next.splice(to, 0, moved);
                    setItems(next);
                    setSavingOrder(true);
                    try {
                      await fetch(`/api/gallery/albums/${albumId}/reorder`, {
                        method: "POST",
                        headers: {
                          ...authHeaders(),
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          itemIds: next.map((p) => p.id),
                        }),
                      });
                    } finally {
                      setSavingOrder(false);
                    }
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                  onClick={() => {
                    if (reordering) return;
                    if (selecting) {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(it.id)) next.delete(it.id);
                        else next.add(it.id);
                        return next;
                      });
                    } else {
                      setLightboxIndex(idx);
                    }
                  }}
                  className={`relative aspect-square rounded overflow-hidden bg-gray-900 group ${
                    isSelected ? "ring-2 ring-violet-400" : ""
                  } ${isDragging ? "opacity-40" : ""} ${
                    isDropTarget ? "ring-2 ring-emerald-400" : ""
                  } ${reordering ? "cursor-grab active:cursor-grabbing" : ""}`}
                >
                  <img
                    src={thumbUrl(it)}
                    alt={it.filename}
                    loading="lazy"
                    draggable={false}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  {it.kind === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent">
                      <Play className="w-7 h-7 text-white drop-shadow" />
                    </div>
                  )}
                  {it.is_favorite === 1 && (
                    <Star className="absolute top-1 right-1 w-4 h-4 fill-yellow-400 text-yellow-400 drop-shadow" />
                  )}
                  {reordering && (
                    <div className="absolute top-1 left-1 bg-black/70 rounded p-0.5">
                      <GripVertical className="w-4 h-4 text-emerald-300" />
                    </div>
                  )}
                  {selecting && !reordering && (
                    <div className="absolute top-1 left-1 bg-black/60 rounded">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-violet-300" />
                      ) : (
                        <Square className="w-5 h-5 text-white/80" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {lightboxIndex !== null && items[lightboxIndex] && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
          onToggleFavorite={onToggleFavorite}
          onSoftDelete={onSoftDelete}
          fileUrl={fileUrlForLightbox}
          allTags={allTags}
          authHeaders={authHeaders}
          onSetAsCover={async (it) => {
            const res = await fetch(`/api/gallery/albums/${albumId}`, {
              method: "PATCH",
              headers: { ...authHeaders(), "Content-Type": "application/json" },
              body: JSON.stringify({ cover_item_id: it.id }),
            });
            if (res.ok) setAlbum(await res.json());
          }}
          isCover={(it) => album?.cover_item_id === it.id}
          onRotated={(updated) => updateItemInPlace(updated)}
        />
      )}

      {showShare && (
        <ShareAlbumModal
          albumId={albumId}
          onClose={() => setShowShare(false)}
        />
      )}

      {showAddPhotos && (
        <AddPhotosPickerModal
          title={`Add photos to ${album.name}`}
          excludeIds={items.map((i) => i.id)}
          onClose={() => setShowAddPhotos(false)}
          onSubmit={async (itemIds) => {
            await fetch(`/api/gallery/albums/${albumId}/items`, {
              method: "POST",
              headers: { ...authHeaders(), "Content-Type": "application/json" },
              body: JSON.stringify({ itemIds }),
            });
            setShowAddPhotos(false);
            await load();
          }}
        />
      )}

      {showBulkTag && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-sm">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-medium text-white flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-sky-300" /> Add tag
              </h3>
              <button
                onClick={() => setShowBulkTag(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                autoFocus
                type="text"
                value={bulkTagValue}
                onChange={(e) => {
                  setBulkTagValue(e.target.value);
                  setBulkTagError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitBulkTag();
                }}
                placeholder="e.g. vacation"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-violet-400"
              />
              {bulkTagError && (
                <p className="text-xs text-red-300">{bulkTagError}</p>
              )}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allTags
                    .filter(
                      (t) =>
                        !bulkTagValue.trim() ||
                        t.startsWith(bulkTagValue.trim().toLowerCase()),
                    )
                    .slice(0, 8)
                    .map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setBulkTagValue(t);
                          setTimeout(() => submitBulkTag(), 0);
                        }}
                        className="px-2 py-0.5 rounded-full text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
                      >
                        {t}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => setShowBulkTag(false)}
                className="px-3 py-1.5 rounded-md text-sm text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={submitBulkTag}
                disabled={bulkTagBusy || !bulkTagValue.trim()}
                className="px-3 py-1.5 rounded-md text-sm bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareAlbumModal({
  albumId,
  onClose,
}: {
  albumId: number;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/gallery/albums/${albumId}/share`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
      }
      setLoading(false);
    })();
  }, [albumId]);

  const url = useMemo(() => {
    if (!token || typeof window === "undefined") return "";
    return `${window.location.origin}/gallery/s/${token}`;
  }, [token]);

  const revoke = async () => {
    if (!confirm("Revoke this share link? The link will stop working.")) return;
    await fetch(`/api/gallery/albums/${albumId}/share`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-medium text-white">Share album</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-400">Generating link…</div>
          ) : token ? (
            <>
              <p className="text-xs text-gray-400">
                Anyone with this link can view the album. No login required.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-sm text-white flex items-center gap-1"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <button
                onClick={revoke}
                className="text-sm text-red-300 hover:text-red-200"
              >
                Revoke link
              </button>
            </>
          ) : (
            <div className="text-sm text-red-300">Failed to create share link.</div>
          )}
        </div>
      </div>
    </div>
  );
}
