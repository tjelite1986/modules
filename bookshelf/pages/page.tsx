"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import {
  Upload,
  BookOpen,
  Trash2,
  FileText,
  BookMarked,
  Image as ImageIcon,
  Search,
  CheckCircle2,
} from "lucide-react";

interface Book {
  slug: string;
  title: string;
  author: string | null;
  format: "epub" | "pdf" | "cbz";
  size_bytes: number | null;
  page_count: number | null;
  cover_url: string | null;
  added_at: string;
  reading: {
    position: string | null;
    percent: number;
    last_read_at: string | null;
    finished_at: string | null;
  } | null;
}

type SortKey = "added" | "title" | "progress";
type FormatFilter = "all" | "epub" | "pdf" | "cbz";

function authHeaders() {
  return {
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : ""}`,
  };
}

function withAuth(url: string | null): string {
  if (!url) return "";
  const tok = typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${encodeURIComponent(tok)}`;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readingTimeEstimate(b: Book): string | null {
  // PDF/CBZ: page-based. EPUB: rough based on file size (~1 KB ≈ 200 words / 250 wpm).
  if (b.format === "pdf" && b.page_count) {
    const mins = b.page_count * 2;
    return `${mins < 60 ? mins + " min" : Math.round(mins / 60) + " h"}`;
  }
  if (b.format === "cbz" && b.page_count) {
    const mins = Math.max(5, Math.round(b.page_count * 0.5));
    return `${mins < 60 ? mins + " min" : Math.round(mins / 60) + " h"}`;
  }
  if (b.format === "epub" && b.size_bytes) {
    const words = (b.size_bytes / 1024) * 150; // crude
    const mins = Math.round(words / 250);
    if (mins < 5) return null;
    return mins < 60 ? `${mins} min` : `${Math.round((mins / 60) * 10) / 10} h`;
  }
  return null;
}

const FORMAT_TINT: Record<Book["format"], string> = {
  epub: "from-emerald-700 to-emerald-900",
  pdf: "from-rose-700 to-rose-900",
  cbz: "from-amber-700 to-amber-900",
};

const FORMAT_LABEL: Record<Book["format"], string> = {
  epub: "EPUB",
  pdf: "PDF",
  cbz: "CBZ",
};

const FORMAT_ICON: Record<Book["format"], typeof BookOpen> = {
  epub: BookOpen,
  pdf: FileText,
  cbz: ImageIcon,
};

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [me, setMe] = useState<{ isAdmin: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");

  const refresh = useCallback(async () => {
    const r = await fetch("/api/books", { headers: authHeaders() });
    if (r.ok) {
      const d = await r.json();
      setBooks(d.books ?? []);
    }
  }, []);

  useEffect(() => {
    refresh();
    fetch("/api/auth/me", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setMe(m ? { isAdmin: !!m.isAdmin } : null));
  }, [refresh]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/api/books", { method: "POST", headers: authHeaders(), body: fd });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error ?? `Upload failed (${r.status})`);
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [refresh],
  );

  const triggerScan = useCallback(async () => {
    setError(null);
    const r = await fetch("/api/books/scan", { method: "POST", headers: authHeaders() });
    if (!r.ok) {
      setError(`Scan failed (${r.status})`);
      return;
    }
    await refresh();
  }, [refresh]);

  const remove = useCallback(
    async (slug: string) => {
      if (!confirm("Remove this book? The file on disk will also be deleted.")) return;
      const r = await fetch(`/api/books/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (r.ok) await refresh();
    },
    [refresh],
  );

  const inProgress = useMemo(
    () =>
      books
        .filter((b) => b.reading && b.reading.percent > 0 && !b.reading.finished_at)
        .sort((a, b) => {
          const ta = a.reading?.last_read_at ?? "";
          const tb = b.reading?.last_read_at ?? "";
          return tb.localeCompare(ta);
        })
        .slice(0, 6),
    [books],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = books;
    if (formatFilter !== "all") out = out.filter((b) => b.format === formatFilter);
    if (q) {
      out = out.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author ?? "").toLowerCase().includes(q),
      );
    }
    return [...out].sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title);
      if (sortKey === "progress") {
        const pa = a.reading?.percent ?? 0;
        const pb = b.reading?.percent ?? 0;
        return pb - pa;
      }
      return b.added_at.localeCompare(a.added_at);
    });
  }, [books, query, sortKey, formatFilter]);

  return (
    <DashboardShell>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookMarked size={22} className="text-emerald-400" />
              Bookshelf
            </h1>
            <p className="text-sm text-gray-400">{books.length} title{books.length === 1 ? "" : "s"}</p>
          </div>
          {me?.isAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={triggerScan}
                className="px-3 py-1.5 rounded-lg border border-dark-border bg-dark-card hover:bg-dark-input text-gray-200 text-sm"
              >
                Rescan folder
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
              >
                <Upload size={14} /> {uploading ? "Uploading…" : "Upload"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".epub,.pdf,.cbz,.zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                }}
              />
            </div>
          )}
        </header>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or author"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-dark-input border border-dark-border text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value as FormatFilter)}
            className="px-2 py-1.5 rounded-lg bg-dark-input border border-dark-border text-sm text-white"
          >
            <option value="all">All formats</option>
            <option value="epub">EPUB</option>
            <option value="pdf">PDF</option>
            <option value="cbz">CBZ</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-2 py-1.5 rounded-lg bg-dark-input border border-dark-border text-sm text-white"
          >
            <option value="added">Recently added</option>
            <option value="title">Title</option>
            <option value="progress">Reading progress</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {inProgress.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold tracking-wider uppercase text-gray-400 mb-2">
              Continue reading
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {inProgress.map((b) => (
                <BookCard key={b.slug} book={b} isAdmin={me?.isAdmin ?? false} onDelete={remove} />
              ))}
            </div>
          </section>
        )}

        {books.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              No books yet.{" "}
              {me?.isAdmin
                ? "Upload one or drop EPUB/PDF/CBZ files into /store/books."
                : "Ask an admin to add some."}
            </p>
          </div>
        ) : (
          <section>
            {inProgress.length > 0 && (
              <h2 className="text-xs font-semibold tracking-wider uppercase text-gray-400 mb-2">
                All books
              </h2>
            )}
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No matches.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {filtered.map((b) => (
                  <BookCard key={b.slug} book={b} isAdmin={me?.isAdmin ?? false} onDelete={remove} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function BookCard({
  book,
  isAdmin,
  onDelete,
}: {
  book: Book;
  isAdmin: boolean;
  onDelete: (slug: string) => void;
}) {
  const Icon = FORMAT_ICON[book.format];
  const eta = readingTimeEstimate(book);
  const finished = !!book.reading?.finished_at;
  return (
    <div className="group relative">
      <Link
        href={`/books/${encodeURIComponent(book.slug)}`}
        className="block aspect-[2/3] rounded-lg overflow-hidden bg-dark-input border border-dark-border hover:border-dark-text/30 transition-colors relative"
      >
        {book.cover_url ? (
          <img
            src={withAuth(book.cover_url)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${FORMAT_TINT[book.format]} flex items-center justify-center`}>
            <Icon size={48} className="text-white/30" />
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-black/60 backdrop-blur-sm text-white">
          {FORMAT_LABEL[book.format]}
        </div>
        {finished && (
          <div className="absolute top-2 right-2 p-1 rounded-full bg-emerald-500/90 text-white" title="Finished">
            <CheckCircle2 size={12} />
          </div>
        )}
        {book.reading && book.reading.percent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${Math.min(100, book.reading.percent)}%` }}
            />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
          <p className="text-white text-xs font-semibold line-clamp-2">{book.title}</p>
          {book.author && (
            <p className="text-gray-300 text-[10px] line-clamp-1 mt-0.5">{book.author}</p>
          )}
        </div>
      </Link>
      {isAdmin && (
        <button
          type="button"
          onClick={() => onDelete(book.slug)}
          className="absolute top-2 right-2 p-1.5 rounded bg-black/60 text-red-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/60"
          aria-label="Delete book"
        >
          <Trash2 size={12} />
        </button>
      )}
      <p className="text-[10px] text-gray-500 mt-1 px-1 flex items-center justify-between gap-1">
        <span className="truncate">
          {book.page_count ? `${book.page_count} pages` : formatSize(book.size_bytes)}
        </span>
        {eta && <span className="text-gray-600 flex-shrink-0">{eta}</span>}
      </p>
    </div>
  );
}
