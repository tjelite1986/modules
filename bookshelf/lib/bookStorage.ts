import path from "node:path";
import fs from "node:fs";

const STORE_ROOT = process.env.STORE_ROOT || path.join(process.cwd(), "store");
export const BOOKS_ROOT = path.join(STORE_ROOT, "books");
export const BOOK_META_DIR = path.join(BOOKS_ROOT, ".meta");
export const BOOK_COVERS_DIR = path.join(BOOKS_ROOT, ".covers");

export type BookFormat = "epub" | "pdf" | "cbz";
const FORMAT_EXT: Record<BookFormat, string[]> = {
  epub: [".epub"],
  pdf: [".pdf"],
  cbz: [".cbz", ".zip"],
};

export function ensureBookDirs(): void {
  for (const d of [BOOKS_ROOT, BOOK_META_DIR, BOOK_COVERS_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export function detectFormat(filename: string): BookFormat | null {
  const ext = path.extname(filename).toLowerCase();
  for (const [fmt, exts] of Object.entries(FORMAT_EXT)) {
    if (exts.includes(ext)) return fmt as BookFormat;
  }
  return null;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "untitled";
}

export function uniqueSlug(base: string, existing: (slug: string) => boolean): string {
  if (!existing(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!existing(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export function bookFilePath(slug: string, format: BookFormat): string {
  return path.join(BOOKS_ROOT, `${slug}.${format}`);
}

export function bookCoverPath(slug: string): string {
  return path.join(BOOK_COVERS_DIR, `${slug}.jpg`);
}
