import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { BOOK_COVERS_DIR, bookCoverPath, type BookFormat } from "./bookStorage";
import { getBook } from "./books";

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;

function ensureCoversDir() {
  if (!fs.existsSync(BOOK_COVERS_DIR)) fs.mkdirSync(BOOK_COVERS_DIR, { recursive: true });
}

function persistCover(slug: string, buffer: Buffer): string {
  ensureCoversDir();
  const dst = bookCoverPath(slug);
  fs.writeFileSync(dst, buffer);
  const db = getDb();
  db.prepare("UPDATE books SET cover_path = ? WHERE slug = ?").run(dst, slug);
  return dst;
}

function recordPageCount(slug: string, count: number) {
  if (!Number.isFinite(count) || count <= 0) return;
  const db = getDb();
  db.prepare("UPDATE books SET page_count = ? WHERE slug = ?").run(Math.round(count), slug);
}

/* ----------------------- EPUB ----------------------- */

async function extractEpubCover(filePath: string): Promise<Buffer | null> {
  try {
    const JSZip = (await import("jszip")).default;
    const buf = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buf);

    const containerXml = await zip.file("META-INF/container.xml")?.async("string");
    if (!containerXml) return null;
    const opfMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!opfMatch) return null;
    const opfPath = opfMatch[1];
    const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : "";

    const opfXml = await zip.file(opfPath)?.async("string");
    if (!opfXml) return null;

    // Strategy 1 (epub3): item with properties="cover-image"
    let coverHref: string | null = null;
    const epub3Match = opfXml.match(/<item[^>]+properties="[^"]*cover-image[^"]*"[^>]+href="([^"]+)"/i);
    if (epub3Match) coverHref = epub3Match[1];

    // Strategy 2 (epub3 alt order): href before properties
    if (!coverHref) {
      const altMatch = opfXml.match(/<item[^>]+href="([^"]+)"[^>]+properties="[^"]*cover-image[^"]*"/i);
      if (altMatch) coverHref = altMatch[1];
    }

    // Strategy 3 (epub2): <meta name="cover" content="<id>"/> then look up manifest item by id
    if (!coverHref) {
      const metaMatch = opfXml.match(/<meta\s+name="cover"\s+content="([^"]+)"/i);
      if (metaMatch) {
        const coverId = metaMatch[1];
        const itemRe = new RegExp(`<item[^>]+id="${coverId.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^>]+href="([^"]+)"`, "i");
        const itemMatch = opfXml.match(itemRe);
        if (itemMatch) coverHref = itemMatch[1];
      }
    }

    // Strategy 4: fallback to any image in the zip named "cover.*"
    if (!coverHref) {
      const direct = Object.keys(zip.files).find((n) =>
        /(^|\/)cover\.(jpe?g|png|webp|gif)$/i.test(n),
      );
      if (direct) coverHref = direct;
    }

    if (!coverHref) return null;

    const fullPath = opfDir ? `${opfDir}/${coverHref}` : coverHref;
    const file = zip.file(fullPath) ?? zip.file(coverHref);
    if (!file) return null;
    return Buffer.from(await file.async("arraybuffer"));
  } catch {
    return null;
  }
}

/* ----------------------- CBZ ----------------------- */

async function extractCbzCover(filePath: string): Promise<{ buffer: Buffer; pageCount: number } | null> {
  try {
    const JSZip = (await import("jszip")).default;
    const buf = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buf);
    const entries = Object.values(zip.files)
      .filter((f) => !f.dir && IMAGE_EXT_RE.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (entries.length === 0) return null;
    const buffer = Buffer.from(await entries[0].async("arraybuffer"));
    return { buffer, pageCount: entries.length };
  } catch {
    return null;
  }
}

/* ----------------------- PDF ----------------------- */

async function runPdftoppm(filePath: string, destBase: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(
      "pdftoppm",
      ["-jpeg", "-r", "100", "-f", "1", "-l", "1", "-singlefile", filePath, destBase],
      { timeout: 120_000 },
    );
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

async function pdfPageCount(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    let out = "";
    const proc = spawn("pdfinfo", [filePath], { timeout: 20_000 });
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", () => resolve(null));
    proc.on("close", () => {
      const m = out.match(/^Pages:\s+(\d+)/m);
      resolve(m ? Number(m[1]) : null);
    });
  });
}

async function extractPdfCover(
  filePath: string,
): Promise<{ buffer: Buffer; pageCount: number | null } | null> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "elite-pdf-cover-"));
  const base = path.join(tmpDir, randomUUID());
  try {
    const ok = await runPdftoppm(filePath, base);
    if (!ok) return null;
    // -singlefile writes <base>.jpg (no page suffix)
    const candidate = `${base}.jpg`;
    if (!fs.existsSync(candidate)) return null;
    const buffer = fs.readFileSync(candidate);
    const pageCount = await pdfPageCount(filePath);
    return { buffer, pageCount };
  } catch {
    return null;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

/* ----------------------- public ----------------------- */

export async function extractCover(slug: string): Promise<boolean> {
  const book = getBook(slug);
  if (!book) return false;
  // Already cached? Skip work.
  if (book.cover_path && fs.existsSync(book.cover_path)) return true;
  if (!fs.existsSync(book.file_path)) return false;

  try {
    if (book.format === "epub") {
      const buf = await extractEpubCover(book.file_path);
      if (!buf) return false;
      persistCover(slug, buf);
      return true;
    }
    if (book.format === "cbz") {
      const result = await extractCbzCover(book.file_path);
      if (!result) return false;
      persistCover(slug, result.buffer);
      recordPageCount(slug, result.pageCount);
      return true;
    }
    if (book.format === "pdf") {
      const result = await extractPdfCover(book.file_path);
      if (!result) return false;
      persistCover(slug, result.buffer);
      if (result.pageCount) recordPageCount(slug, result.pageCount);
      return true;
    }
  } catch (err) {
    console.error(`[books] cover extraction failed for ${slug}:`, (err as Error).message);
  }
  return false;
}

export async function extractAllMissing(): Promise<{ done: number; failed: number }> {
  const db = getDb();
  const slugs = db
    .prepare("SELECT slug FROM books WHERE cover_path IS NULL")
    .all() as Array<{ slug: string }>;
  let done = 0;
  let failed = 0;
  for (const { slug } of slugs) {
    const ok = await extractCover(slug);
    if (ok) done++;
    else failed++;
  }
  return { done, failed };
}
