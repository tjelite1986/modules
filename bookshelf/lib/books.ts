import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import {
  BOOKS_ROOT,
  BOOK_COVERS_DIR,
  type BookFormat,
  bookFilePath,
  bookCoverPath,
  detectFormat,
  ensureBookDirs,
  slugify,
  uniqueSlug,
} from "./bookStorage";

export interface BookRow {
  slug: string;
  title: string;
  author: string | null;
  format: BookFormat;
  file_path: string;
  cover_path: string | null;
  size_bytes: number | null;
  page_count: number | null;
  added_at: string;
  added_by: number | null;
}

export interface BookWithState extends BookRow {
  cover_url: string | null;
  reading: {
    position: string | null;
    percent: number;
    last_read_at: string | null;
    finished_at: string | null;
  } | null;
}

export function listBooks(viewerId: number | null): BookWithState[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT b.*,
              s.position AS state_position, s.percent AS state_percent,
              s.last_read_at AS state_last_read, s.finished_at AS state_finished
         FROM books b
         LEFT JOIN book_reading_state s
           ON s.book_slug = b.slug AND s.user_id = ?
        ORDER BY b.added_at DESC`,
    )
    .all(viewerId ?? -1) as Array<BookRow & {
      state_position: string | null;
      state_percent: number | null;
      state_last_read: string | null;
      state_finished: string | null;
    }>;
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    author: r.author,
    format: r.format,
    file_path: r.file_path,
    cover_path: r.cover_path,
    cover_url: r.cover_path ? `/api/books/${encodeURIComponent(r.slug)}/cover` : null,
    size_bytes: r.size_bytes,
    page_count: r.page_count,
    added_at: r.added_at,
    added_by: r.added_by,
    reading:
      r.state_last_read !== null
        ? {
            position: r.state_position,
            percent: r.state_percent ?? 0,
            last_read_at: r.state_last_read,
            finished_at: r.state_finished,
          }
        : null,
  }));
}

export function getBook(slug: string): BookRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM books WHERE slug = ?").get(slug) as
    | BookRow
    | undefined;
  return row ?? null;
}

export function deleteBook(slug: string): boolean {
  const book = getBook(slug);
  if (!book) return false;
  try {
    fs.unlinkSync(book.file_path);
  } catch {}
  if (book.cover_path) {
    try {
      fs.unlinkSync(book.cover_path);
    } catch {}
  }
  const db = getDb();
  db.prepare("DELETE FROM books WHERE slug = ?").run(slug);
  return true;
}

export interface IngestInput {
  filename: string;
  buffer: Buffer;
  addedBy?: number | null;
  titleOverride?: string;
  authorOverride?: string;
}

export function ingestUpload(input: IngestInput): BookRow {
  ensureBookDirs();
  const fmt = detectFormat(input.filename);
  if (!fmt) throw new Error("Unsupported file format (need .epub, .pdf, .cbz)");

  const db = getDb();
  const baseSlug = slugify(input.titleOverride || path.basename(input.filename, path.extname(input.filename)));
  const existing = (s: string) =>
    !!db.prepare("SELECT 1 FROM books WHERE slug = ?").get(s);
  const slug = uniqueSlug(baseSlug, existing);

  const destPath = bookFilePath(slug, fmt);
  fs.writeFileSync(destPath, input.buffer);

  const title = input.titleOverride?.trim() || prettifyName(input.filename);
  const author = input.authorOverride?.trim() || null;

  db.prepare(
    `INSERT INTO books (slug, title, author, format, file_path, size_bytes, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(slug, title, author, fmt, destPath, input.buffer.length, input.addedBy ?? null);

  return getBook(slug)!;
}

export function scanFs(): { added: number; removed: number } {
  ensureBookDirs();
  const db = getDb();
  let added = 0;
  let removed = 0;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(BOOKS_ROOT, { withFileTypes: true });
  } catch {
    return { added: 0, removed: 0 };
  }

  const onDiskPaths = new Set<string>();
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (e.name.startsWith(".")) continue;
    const fmt = detectFormat(e.name);
    if (!fmt) continue;
    const filePath = path.join(BOOKS_ROOT, e.name);
    onDiskPaths.add(filePath);

    const known = db.prepare("SELECT slug FROM books WHERE file_path = ?").get(filePath);
    if (known) continue;

    const baseSlug = slugify(path.basename(e.name, path.extname(e.name)));
    const existing = (s: string) =>
      !!db.prepare("SELECT 1 FROM books WHERE slug = ?").get(s);
    const slug = uniqueSlug(baseSlug, existing);
    const title = prettifyName(e.name);
    let size = 0;
    try {
      size = fs.statSync(filePath).size;
    } catch {}
    db.prepare(
      `INSERT INTO books (slug, title, format, file_path, size_bytes)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(slug, title, fmt, filePath, size);
    added++;
  }

  // Drop rows whose underlying file is gone (only if path is inside BOOKS_ROOT).
  const allRows = db.prepare("SELECT slug, file_path FROM books").all() as Array<{
    slug: string;
    file_path: string;
  }>;
  for (const row of allRows) {
    if (!row.file_path.startsWith(BOOKS_ROOT + path.sep)) continue;
    if (!fs.existsSync(row.file_path)) {
      db.prepare("DELETE FROM books WHERE slug = ?").run(row.slug);
      removed++;
    }
  }
  return { added, removed };
}

function prettifyName(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, "");
  return name
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getReadingState(slug: string, userId: number) {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT position, percent, last_read_at, finished_at FROM book_reading_state WHERE book_slug = ? AND user_id = ?",
    )
    .get(slug, userId) as
    | { position: string | null; percent: number; last_read_at: string; finished_at: string | null }
    | undefined;
  return row ?? null;
}

export function setReadingState(
  slug: string,
  userId: number,
  patch: { position?: string | null; percent?: number; finished?: boolean },
): void {
  const db = getDb();
  const existing = getReadingState(slug, userId);
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const finishedAt = patch.finished
    ? now
    : patch.finished === false
      ? null
      : existing?.finished_at ?? null;
  if (existing) {
    db.prepare(
      `UPDATE book_reading_state
          SET position = COALESCE(?, position),
              percent = COALESCE(?, percent),
              last_read_at = ?,
              finished_at = ?
        WHERE book_slug = ? AND user_id = ?`,
    ).run(
      patch.position ?? null,
      patch.percent ?? null,
      now,
      finishedAt,
      slug,
      userId,
    );
  } else {
    db.prepare(
      `INSERT INTO book_reading_state (book_slug, user_id, position, percent, last_read_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(slug, userId, patch.position ?? null, patch.percent ?? 0, now, finishedAt);
  }
}

export function coverFileFor(slug: string): string | null {
  const p = bookCoverPath(slug);
  if (fs.existsSync(p)) return p;
  return null;
}

export { BOOK_COVERS_DIR };
