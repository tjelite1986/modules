# bookshelf

A shared bookshelf with a built-in EPUB / PDF / CBZ reader and per-user reading-position sync. The catalogue is FS-driven: drop files into `BOOKS_ROOT/` and an admin `POST /api/books/scan` ingests them. PDF covers are extracted with `poppler-utils` (`pdftoppm`).

## What's included

- `lib/books.ts` — catalogue (`listBooks`, `getBook`, `ingestUpload`) and per-user reading state (`getReadingState`, `setReadingState`)
- `lib/bookStorage.ts` — `BOOKS_ROOT`, `BOOK_COVERS_DIR`, `detectFormat`, `slugify`, `uniqueSlug`, path helpers
- `lib/bookCovers.ts` — `extractCover` (uses `pdftoppm -singlefile` for PDF, embedded cover for EPUB, first image for CBZ)
- `api/books/route.ts` — `GET` list, `POST` upload + auto-extract cover (admin only)
- `api/books/scan/route.ts` — `POST` rescan `BOOKS_ROOT` (admin only)
- `api/books/[slug]/route.ts` — `GET` metadata + per-user state, `DELETE` (admin only)
- `api/books/[slug]/cover/route.ts` — `GET` cover PNG, `verifyTokenLoose` so `<img src="…?t=<mediaToken>">` works
- `api/books/[slug]/file/route.ts` — `GET` book file, `verifyTokenLoose` for `<embed>/<iframe>/<a download>`
- `api/books/[slug]/state/route.ts` — `GET`/`PUT` reading position + percent + `finished_at`
- `pages/page.tsx` — `/books` listing with cover grid, in-progress / unread / finished tabs
- `pages/[slug]-page.tsx` + `components/ReaderClient.tsx` — `/books/<slug>` reader page; format-aware client renders EPUB via `epubjs`, PDF via `pdfjs-dist`, CBZ via `jszip`
- `db/schema.sql` — `books` + `book_reading_state`

## How it works

```
BOOKS_ROOT/
  the-great-gatsby.epub
  some-comic.cbz
  manuals/textbook.pdf       ← top level only; subdirs are ignored

BOOK_COVERS_DIR/              ← writable, separate volume
  the-great-gatsby.png
  some-comic.png
  textbook.png
```

- `POST /api/books/scan` walks the top level of `BOOKS_ROOT`, computes a slug from filename, upserts the row, extracts a cover into `BOOK_COVERS_DIR/<slug>.png` (800px wide).
- Reading state is stored per `(book_slug, user_id)`. EPUB positions are CFI strings, PDF/CBZ positions are stringified page numbers.
- `percent` is stored as an integer 0-100 so the UI can sort "in progress" by `last_read_at DESC` and show progress bars without recomputing.
- Cover and file routes accept `?t=<jwt>` so the browser can render them via plain HTML tags (no `fetch` + blob URL dance).

## pdfjs worker

`pdfjs-dist` expects a worker script at runtime. Bundling it via dynamic import is unreliable across Next 14 versions, so this module's `ReaderClient.tsx` references a **local file**:

```ts
pdfjsModule.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
```

After install, copy the worker into `public/`:

```bash
mkdir -p public/pdfjs
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdfjs/
```

(Or wire this into your build script — the file is small and doesn't change between minor versions of `pdfjs-dist`.)

## Install

```bash
cp lib/books.ts lib/bookStorage.ts lib/bookCovers.ts <app>/src/lib/
cp -r api/* <app>/src/app/api/books/
cp pages/page.tsx <app>/src/app/books/page.tsx
mkdir -p <app>/src/app/books/'[slug]'
cp pages/'[slug]-page.tsx' <app>/src/app/books/'[slug]/page.tsx'
cp components/ReaderClient.tsx <app>/src/app/books/'[slug]/ReaderClient.tsx'
cp db/schema.sql <app>/db/migrations/041_books.sql
sqlite3 data/app.db < <app>/db/migrations/041_books.sql

# system deps
sudo apt-get install -y poppler-utils

# pdfjs worker (see above)
mkdir -p <app>/public/pdfjs
cp <app>/node_modules/pdfjs-dist/build/pdf.worker.min.mjs <app>/public/pdfjs/
```

Then set `BOOKS_ROOT` and `BOOK_COVERS_DIR` in `.env`, mount the former as a host volume, and `POST /api/books/scan` once to ingest existing files.

## Requires

- `authentication` module **>= 0.3.0** — needs `verifyTokenLoose` (media-scope query auth) and the `@/lib/mediaToken` client helper for cover/file routes
- `poppler-utils` on the host (provides `pdftoppm`)
- A writable directory for cover thumbnails (separate from `BOOKS_ROOT` so the books volume can stay read-only if you want)

## Provides

- `@/lib/books` — `listBooks`, `getBook`, `ingestUpload`, `getReadingState`, `setReadingState`
- `@/lib/bookStorage` — `BOOKS_ROOT`, `BOOK_COVERS_DIR`, `bookFilePath`, `bookCoverPath`, `detectFormat`, `ensureBookDirs`, `slugify`, `uniqueSlug`
- `@/lib/bookCovers` — `extractCover`

## Security note: media token in `?t=` query

The cover and file routes use `verifyTokenLoose`, which accepts a `?t=` query parameter so that plain `<img>`, `<embed>`, `<iframe>` and `<a download>` tags can authenticate without setting custom headers. Since authentication 0.3.0 this parameter only accepts a short-lived (24 h) media-scoped capability token — the full session JWT is rejected in URLs, and a leaked media token cannot be replayed against the regular API. See the [authentication module](../authentication/README.md) for the token flow; the client pages here use `mediaToken()` from `@/lib/mediaToken` to build asset URLs.

URLs still leak — through access logs, browser history, the `Referer` header (significant here: EPUB and PDF readers render embedded content that can trigger outbound requests), and intermediate proxies — but the blast radius is now read-only media access for at most 24 h, revoked on logout.

For defense in depth, set `Referrer-Policy: no-referrer` on cover and file responses so an embedded link inside a rendered book can't leak the token-bearing URL. The current routes do not do this — patch them in your fork if you ship to anyone you don't trust.

## Known gotchas

- `epubjs` is **pinned to `0.3.93`** — versions `0.4.x` reintroduce a legacy `xmldom` dependency with a critical CVE. Don't let your lockfile drift.
- If `pdftoppm` is missing, PDF uploads succeed but covers come up blank. Check container PATH inside Docker.
- CBZ readers expect natural-order page filenames (`page-001.jpg`, etc). `jszip` sorts lexicographically, so a zip with `1.jpg`, `2.jpg`, …, `10.jpg` will display pages in the wrong order. Re-zip with zero-padded names if you hit this.
