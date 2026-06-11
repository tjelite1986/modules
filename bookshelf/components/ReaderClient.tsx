"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Circle,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { mediaToken } from "@/lib/mediaToken";

interface Props {
  slug: string;
  title: string;
  author: string | null;
  format: "epub" | "pdf" | "cbz";
}

type EpubTheme = "light" | "sepia" | "dark";
interface TocNode {
  id: string;
  label: string;
  href: string;
  subitems?: TocNode[];
}

function authHeaders() {
  return {
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : ""}`,
  };
}

function fileUrl(slug: string): string {
  return `/api/books/${encodeURIComponent(slug)}/file?t=${encodeURIComponent(mediaToken())}`;
}

async function loadInitialState(
  slug: string,
): Promise<{ position: string | null; percent: number; finished: boolean } | null> {
  const r = await fetch(`/api/books/${encodeURIComponent(slug)}/state`, { headers: authHeaders() });
  if (!r.ok) return null;
  const data = await r.json();
  return data.state
    ? {
        position: data.state.position,
        percent: data.state.percent ?? 0,
        finished: !!data.state.finished_at,
      }
    : null;
}

async function saveState(
  slug: string,
  patch: { position?: string | null; percent?: number; finished?: boolean },
) {
  try {
    await fetch(`/api/books/${encodeURIComponent(slug)}/state`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {}
}

export default function ReaderClient(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    loadInitialState(props.slug).then((s) => {
      if (s?.finished) setFinished(true);
    });
  }, [props.slug]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggleFinished = useCallback(async () => {
    const next = !finished;
    setFinished(next);
    await saveState(props.slug, { finished: next, percent: next ? 100 : undefined });
  }, [finished, props.slug]);

  return (
    <div ref={rootRef} className="fixed inset-0 bg-dark-bg flex flex-col">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-dark-border bg-dark-card flex-shrink-0">
        <Link
          href="/books"
          className="p-1.5 rounded hover:bg-dark-input text-gray-300 hover:text-white"
          aria-label="Back to bookshelf"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-white truncate">{props.title}</h1>
          {props.author && <p className="text-[11px] text-gray-400 truncate">{props.author}</p>}
        </div>
        <button
          type="button"
          onClick={toggleFinished}
          className={`p-1.5 rounded hover:bg-dark-input ${finished ? "text-emerald-400" : "text-gray-400 hover:text-white"}`}
          aria-label={finished ? "Mark as unread" : "Mark as finished"}
          title={finished ? "Mark as unread" : "Mark as finished"}
        >
          {finished ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 rounded hover:bg-dark-input text-gray-300 hover:text-white"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-dark-input text-gray-300">
          {props.format}
        </span>
      </header>

      <div className="flex-1 min-h-0 relative">
        {props.format === "epub" && <EpubReader {...props} />}
        {props.format === "pdf" && <PdfReader {...props} />}
        {props.format === "cbz" && <CbzReader {...props} />}
      </div>
    </div>
  );
}

/* ----------------------- EPUB ----------------------- */

const THEME_BG: Record<EpubTheme, string> = { light: "#ffffff", sepia: "#f4ecd8", dark: "#1a1a1a" };
const THEME_FG: Record<EpubTheme, string> = { light: "#111", sepia: "#5b4636", dark: "#e5e7eb" };

function EpubReader({ slug }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<{
    display: (target?: string) => Promise<void>;
    on: (event: string, cb: (...args: unknown[]) => void) => void;
    next: () => Promise<void>;
    prev: () => Promise<void>;
    destroy?: () => void;
    themes: {
      register: (name: string, rules: Record<string, Record<string, string>>) => void;
      select: (name: string) => void;
      fontSize: (size: string) => void;
    };
  } | null>(null);
  const bookRef = useRef<{
    ready: Promise<unknown>;
    loaded: { navigation: Promise<{ toc: TocNode[] }> };
    locations?: { generate: (n: number) => Promise<void>; percentageFromCfi: (cfi: string) => number };
    destroy?: () => void;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<EpubTheme>("dark");
  const [fontSize, setFontSize] = useState(100);
  const [toc, setToc] = useState<TocNode[]>([]);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const ePub = (await import("epubjs")).default;
        if (cancelled || !containerRef.current) return;
        const url = fileUrl(slug);
        const book = ePub(url, { openAs: "epub" }) as never;
        bookRef.current = book as never;
        const rendition = (book as unknown as { renderTo: (el: HTMLElement, opts: Record<string, unknown>) => unknown }).renderTo(
          containerRef.current,
          {
            width: "100%",
            height: "100%",
            allowScriptedContent: false,
            spread: "auto",
            flow: "paginated",
          },
        ) as never;
        renditionRef.current = rendition as never;

        // Register themes once
        for (const t of ["light", "sepia", "dark"] as EpubTheme[]) {
          (rendition as { themes: { register: (n: string, r: Record<string, Record<string, string>>) => void } }).themes.register(t, {
            body: { background: THEME_BG[t], color: THEME_FG[t] },
            "p, div, span, li, a": { color: THEME_FG[t] },
          });
        }
        (rendition as { themes: { select: (n: string) => void } }).themes.select(theme);
        (rendition as { themes: { fontSize: (s: string) => void } }).themes.fontSize(`${fontSize}%`);

        const initial = await loadInitialState(slug);
        await (rendition as { display: (target?: string) => Promise<void> }).display(initial?.position ?? undefined);
        setLoading(false);

        (book as { ready: Promise<unknown> }).ready.then(async () => {
          try {
            await (book as { locations: { generate: (n: number) => Promise<void> } }).locations.generate(1024);
          } catch {}
        });

        (book as { loaded: { navigation: Promise<{ toc: TocNode[] }> } }).loaded.navigation
          .then((nav) => {
            if (!cancelled) setToc(nav.toc ?? []);
          })
          .catch(() => {});

        (rendition as { on: (event: string, cb: (loc: { start: { cfi: string } }) => void) => void }).on(
          "relocated",
          (loc) => {
            const cfi = loc?.start?.cfi;
            if (!cfi) return;
            let percent = 0;
            try {
              percent = Math.round(
                ((book as { locations?: { percentageFromCfi: (cfi: string) => number } }).locations?.percentageFromCfi(cfi) ?? 0) * 100,
              );
            } catch {}
            saveState(slug, { position: cfi, percent });
          },
        );
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load book");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        renditionRef.current?.destroy?.();
      } catch {}
      try {
        bookRef.current?.destroy?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Re-apply theme/fontSize when state changes
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    try {
      r.themes.select(theme);
      r.themes.fontSize(`${fontSize}%`);
    } catch {}
  }, [theme, fontSize]);

  const next = useCallback(() => renditionRef.current?.next?.(), []);
  const prev = useCallback(() => renditionRef.current?.prev?.(), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const jumpTo = useCallback((href: string) => {
    renditionRef.current?.display(href).catch(() => {});
    setTocOpen(false);
  }, []);

  const cycleTheme = () => {
    setTheme((t) => (t === "light" ? "sepia" : t === "sepia" ? "dark" : "light"));
  };

  return (
    <div className="absolute inset-0" style={{ background: THEME_BG[theme] }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Loader2 className="animate-spin text-emerald-400" size={32} />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm z-20">
          {error}
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute top-2 right-2 z-30 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-1 py-1">
        <button
          type="button"
          onClick={() => setTocOpen((o) => !o)}
          className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10"
          aria-label="Table of contents"
          title="Contents"
          disabled={toc.length === 0}
        >
          <Menu size={16} />
        </button>
        <button
          type="button"
          onClick={cycleTheme}
          className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10"
          aria-label={`Theme: ${theme}`}
          title={`Theme: ${theme} (click to cycle)`}
        >
          {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button
          type="button"
          onClick={() => setFontSize((s) => Math.max(70, s - 10))}
          className="px-2 py-1 text-white/80 hover:text-white text-xs font-bold"
          aria-label="Smaller text"
        >
          A−
        </button>
        <span className="text-white/60 text-[10px] tabular-nums w-8 text-center">{fontSize}%</span>
        <button
          type="button"
          onClick={() => setFontSize((s) => Math.min(200, s + 10))}
          className="px-2 py-1 text-white/80 hover:text-white text-sm font-bold"
          aria-label="Larger text"
        >
          A+
        </button>
      </div>

      {tocOpen && (
        <div
          className="absolute inset-0 bg-black/50 z-40"
          onClick={() => setTocOpen(false)}
        >
          <aside
            className="absolute top-0 left-0 bottom-0 w-72 bg-dark-card border-r border-dark-border overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-dark-border sticky top-0 bg-dark-card">
              <h3 className="text-sm font-semibold text-white">Contents</h3>
              <button
                type="button"
                onClick={() => setTocOpen(false)}
                className="p-1 text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <nav className="p-2">
              <TocList nodes={toc} onJump={jumpTo} depth={0} />
            </nav>
          </aside>
        </div>
      )}

      <NavOverlay onPrev={prev} onNext={next} />
    </div>
  );
}

function TocList({ nodes, onJump, depth }: { nodes: TocNode[]; onJump: (href: string) => void; depth: number }) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => onJump(n.href)}
            className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-300 hover:bg-dark-input hover:text-white truncate"
            style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
          >
            {n.label.trim() || "(untitled)"}
          </button>
          {n.subitems && n.subitems.length > 0 && (
            <TocList nodes={n.subitems} onJump={onJump} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

/* ----------------------- PDF ----------------------- */

function PdfReader({ slug }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<unknown>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const pdfjsModule = pdfjs as unknown as {
          GlobalWorkerOptions: { workerSrc: string };
        };
        pdfjsModule.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        if (cancelled) return;
        const url = fileUrl(slug);
        const loadingTask = (
          pdfjs as {
            getDocument: (src: {
              url: string;
              rangeChunkSize?: number;
              disableAutoFetch?: boolean;
              disableStream?: boolean;
            }) => { promise: Promise<unknown> };
          }
        ).getDocument({
          url,
          rangeChunkSize: 256 * 1024,
          disableAutoFetch: true,
          disableStream: false,
        });
        const pdf = (await loadingTask.promise) as { numPages: number; getPage: (n: number) => Promise<unknown> };
        if (cancelled) return;
        pdfRef.current = pdf;
        setTotalPages(pdf.numPages);
        const initial = await loadInitialState(slug);
        const initialPage = initial?.position
          ? Math.max(1, Math.min(pdf.numPages, parseInt(initial.position, 10) || 1))
          : 1;
        setPageNum(initialPage);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load PDF");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const pdf = pdfRef.current as { getPage: (n: number) => Promise<unknown> } | null;
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const page = (await pdf.getPage(pageNum)) as {
        getViewport: (opts: { scale: number }) => { width: number; height: number };
        render: (ctx: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
      };
      if (cancelled || !canvasRef.current) return;
      const containerWidth = canvasRef.current.parentElement?.clientWidth ?? 800;
      const viewport0 = page.getViewport({ scale: 1 });
      const scale = Math.min(2, (containerWidth - 16) / viewport0.width);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (cancelled) return;
      const percent = totalPages > 0 ? Math.round((pageNum / totalPages) * 100) : 0;
      saveState(slug, { position: String(pageNum), percent });
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNum, slug, totalPages]);

  const next = useCallback(() => setPageNum((p) => Math.min(totalPages || p, p + 1)), [totalPages]);
  const prev = useCallback(() => setPageNum((p) => Math.max(1, p - 1)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return (
    <div className="absolute inset-0 overflow-auto bg-dark-bg flex flex-col items-center py-4">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-400" size={32} />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
          {error}
        </div>
      )}
      <canvas ref={canvasRef} className="shadow-lg bg-white" />
      <NavOverlay onPrev={prev} onNext={next} label={`${pageNum} / ${totalPages}`} />
    </div>
  );
}

/* ----------------------- CBZ ----------------------- */

function CbzReader({ slug }: Props) {
  const [pages, setPages] = useState<string[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      try {
        const JSZip = (await import("jszip")).default;
        const res = await fetch(fileUrl(slug));
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const zip = await JSZip.loadAsync(buf);
        const imageEntries = Object.values(zip.files)
          .filter((f) => !f.dir && /\.(jpe?g|png|webp|gif)$/i.test(f.name))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const urls: string[] = [];
        for (const entry of imageEntries) {
          const blob = await entry.async("blob");
          const url = URL.createObjectURL(blob);
          urls.push(url);
          created.push(url);
        }
        if (cancelled) return;
        setPages(urls);
        const initial = await loadInitialState(slug);
        const initialIdx = initial?.position
          ? Math.max(0, Math.min(urls.length - 1, parseInt(initial.position, 10) || 0))
          : 0;
        setPageIdx(initialIdx);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load comic");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      for (const u of created) URL.revokeObjectURL(u);
    };
  }, [slug]);

  useEffect(() => {
    if (pages.length === 0) return;
    const percent = Math.round(((pageIdx + 1) / pages.length) * 100);
    saveState(slug, { position: String(pageIdx), percent });
  }, [pageIdx, pages.length, slug]);

  const next = useCallback(() => setPageIdx((i) => Math.min(pages.length - 1, i + 1)), [pages.length]);
  const prev = useCallback(() => setPageIdx((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
      {loading && <Loader2 className="animate-spin text-emerald-400" size={32} />}
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {!loading && !error && pages[pageIdx] && (
        <img src={pages[pageIdx]} alt="" className="max-w-full max-h-full object-contain" />
      )}
      <NavOverlay onPrev={prev} onNext={next} label={pages.length ? `${pageIdx + 1} / ${pages.length}` : undefined} />
    </div>
  );
}

/* ----------------------- shared nav ----------------------- */

function NavOverlay({ onPrev, onNext, label }: { onPrev: () => void; onNext: () => void; label?: string }) {
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center z-20"
        aria-label="Previous page"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        onClick={onNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center z-20"
        aria-label="Next page"
      >
        <ChevronRight size={20} />
      </button>
      {label && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-xs z-20">
          {label}
        </div>
      )}
    </>
  );
}
