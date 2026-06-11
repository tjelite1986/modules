# Changelog

All notable changes to the modules library are tracked here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The library is rolling — there are no release tags. Each module carries its own `version` field in `module.json`; entries here describe what changed at the library level.

## [Unreleased]

## 2026-06-11

### Changed

- `authentication` (0.2.1 → **0.3.0**) — `?t=` query auth on asset routes now requires a short-lived (24 h) media-scoped capability token instead of the full session JWT. New `signMediaToken` server export, new `GET /api/auth/media-token` route, and new client helper `lib/mediaToken.ts` (`mediaToken` / `ensureMediaToken` / `clearMediaToken`, localStorage-cached with background refresh). `verifyTokenLoose` rejects session JWTs in query strings, regular header auth rejects media tokens, and media tokens inherit the parent session `jti` so logout revokes them. Closes the JWT-in-URL tradeoff documented in 0.2.1. Backported from [elite-hub commit `311efa2`](https://github.com/tjelite1986/elite-hub/commit/311efa2).
- `bookshelf` (0.1.0 → **0.2.0**) — reader and listing pages build cover/file URLs with `mediaToken()` instead of embedding the session JWT. Requires `authentication >= 0.3.0`.
- `photo-gallery` (0.1.0 → **0.2.0**) — all client components (timeline, albums, smart albums, map, trips, tags, year-in-review, bulk download) build thumb/preview/file URLs with `mediaToken()` instead of embedding the session JWT. Requires `authentication >= 0.3.0`.
- `photo-gallery` (0.2.0 → **0.2.1**) — lightbox info rows (filename, type, size, storage key, EXIF fields) gained copy-to-clipboard buttons with check-mark feedback, falling back to `execCommand` outside secure contexts. Backported from [elite-hub commit `efc9f30`](https://github.com/tjelite1986/elite-hub/commit/efc9f30).
- `photo-gallery` (0.3.1 → **0.3.2**) — thumb/preview/file URLs now carry a `&v=<media_version>` cache-buster. The asset routes serve `Cache-Control: immutable` for a year, so regenerated derivatives (rotate, HEIF repair) kept showing stale in browsers; the new `media_version` column is bumped on every regeneration. Backported from [elite-hub commit `945266b`](https://github.com/tjelite1986/elite-hub/commit/945266b).
- `photo-gallery` (0.3.0 → **0.3.1**) — fixed HEIC/HEIF photos decoding as a single zoomed-in 512px tile: ffmpeg/ffprobe can't handle tiled HEIF, so ingest and `makeImageThumb` now convert via libheif (`heif-convert`) first; thumbs, previews and stored dimensions all derive from the converted JPEG. New `POST /api/gallery/repair-heif` + "Repair HEIF previews" maintenance action regenerate already-ingested items. `libheif-tools` + `ffmpeg` added as documented system deps. Backported from [elite-hub commit `58bf32e`](https://github.com/tjelite1986/elite-hub/commit/58bf32e).
- `photo-gallery` (0.2.1 → **0.3.0**) — capture dates are now parsed from filenames (WhatsApp `IMG-yyyymmdd-WA####`, Samsung/Android `yyyymmdd_hhmmss`, Pixel `PXL_…`, screenshots, Telegram/Signal, Dropbox, epoch-named files) via new `lib/filenameDate.ts` with strict validation. Ingest falls back EXIF → filename → mtime → now. New `POST /api/gallery/backfill-filename-dates` + "Fix dates from filenames" maintenance action re-date existing items; anything still carrying an EXIF date is left untouched. Backported from [elite-hub commit `aaac1b1`](https://github.com/tjelite1986/elite-hub/commit/aaac1b1).

## 2026-06-08

### Added

Three modules extracted from the next round of elite-hub work (library count: 58 → 60):

- **`bookshelf`** — Shared bookshelf with EPUB / PDF / CBZ reader, per-user reading-position sync, and FS-driven catalogue scan. Uses `poppler-utils` (`pdftoppm -singlefile`) for PDF covers. Local-file pdfjs worker (bundling via dynamic import is unreliable across Next 14 versions). `epubjs` pinned to `0.3.93` to avoid the `0.4.x` xmldom CVE. Cover/file routes use `verifyTokenLoose` for `?t=` query auth so plain `<img>/<embed>/<iframe>` tags work — requires `authentication >= 0.2.1`.
- **`video-share`** — Drop-in "share to feed / story / DM" modal. Polymorphic `ShareSource` (gallery item, external mediaUrl, or batch) into one consistent UI over `social-feed`, `stories-with-ttl`, `direct-messaging`. Three-tab UI that gracefully degrades if optional modules aren't installed.
- **`dashboard-widgets`** — Free-form per-user dashboard: drag, resize from 8 directions, vertical compaction, three breakpoints (lg 24 / md 12 / sm 1 cols). Storage + API + `DashboardGrid` wrapper around `react-grid-layout` 1.5 with custom cyan corner/edge handles. Does **not** include integration widgets (weather / Home Assistant / Docker etc — those are project-specific).

### Changed

- `authentication` (0.2.0 → **0.2.1**) — added `verifyTokenLoose(req)` for `?t=<jwt>` query-string auth on asset routes (covers, books, video files). Internal `verifyTokenString` helper extracted to share between `verifyToken` and the new function. Required by `bookshelf`.
- `clips-library` (0.2.0 → **0.2.0**, patch in place) — hardened `lib/clipsSync.ts` against argv-flag-smuggling (added `--` separator + `assertSafeUrl` checking `http(s)` and no leading `-`) and path traversal (`assertSafeVideoId` constraining yt-dlp-returned `videoId` to `^[A-Za-z0-9._-]{1,64}$`). Backported from automated security review.

### Deprecated

- `tiktok-mirror` (0.1.0 → **0.2.0, deprecated**) — superseded by `clips-library`. The TikTok stack has been folded into the unified `clip_profiles` model (auto-poll, per-profile videos limit, sticky skip-list). Module folder kept for reference; will be removed in a future release.

### Changed

- `authentication` (0.1.0 → **0.2.0**) — added DB-backed brute-force lockout. New `lib/loginRateLimit.ts` exports `checkAllowed` / `recordFailure` / `recordSuccess`, new `login_attempts` table in `db/schema.sql`, login route gated by per-identifier ladder (5/10/20 fails → 5 min / 30 min / 4 h lock). Lock responds 429 with `Retry-After`; success clears the counter; rows scrubbed after 24 h idle. Backported from [elite-hub commit `eca5d23`](https://github.com/tjelite1986/elite-hub/commit/eca5d23).
- `clips-library` (0.1.0 → **0.2.0**) — ported the full unified profile registry from elite-hub:
  - New tables `clip_profiles` (with `videos_limit`) and `clip_profile_skipped` in `db/schema.sql`
  - New `lib/clipsSync.ts` with yt-dlp orchestration (`syncClipProfile`, `syncAllAutoPollProfiles`, `downloadSingleVideo`, `markVideoSkipped`, `upsertClipProfile`, …)
  - New API routes: `/api/clips/profiles`, `/api/clips/profiles/:profile/{sync,download,candidates}`, `/api/clips/sync-all` (all write routes admin-gated)
  - New admin drawer `components/[profile]/ProfileAdminPanel.tsx`
  - Adds `gray-matter` npm dep and `yt-dlp` system dep
  - Backported from [elite-hub migrations 043/045/046 + `src/lib/clipsSync.ts`](https://github.com/tjelite1986/elite-hub)

## 2026-05-13

### Added

16 new modules extracted from [elite-hub](https://github.com/tjelite1986/elite-hub) (library count: 41 → 57):

**Media (6):**
- `photo-gallery` — Google-Photos-style library: timeline, albums, smart albums, map, trips, year-review, tags, share-links, EXIF + geotag, content-hash dedup
- `clips-library` — per-profile short-video library with posters, comments, view / like counters, transcode-status tracking
- `tiktok-mirror` — yt-dlp profile follow with daily metadata poll and lazy video download on first watch
- `instagram-mirror` — Instagram profile mirror via gallery-dl (yt-dlp fallback)
- `stories-with-ttl` — Instagram / Snapchat-style ephemeral stories with archival
- `transcoder-pipeline` — host-side ffmpeg + VLC automation to convert originals to `.web.mp4`, plus organise / archive scripts and systemd unit files

**Notification + social (3):**
- `web-push-vapid` — VAPID-based Web Push with subscription storage
- `notification-bell` — in-app notification center with bell icon and Socket.IO live updates
- `follows-system` — user → user follows plus a generic table for following non-user profiles

**UI + platform (5):**
- `dashboard-shell` — collapsible sidebar + top-bar layout pattern with feature-gated nav
- `pwa-service-worker` — minimal PWA package (push handler, notificationclick, Web Share Target receiver)
- `adults-pin-gate` — per-user 4-digit PIN for gating 18+ areas
- `avatar-banner-upload` — in-browser cropping for avatars + banners
- `section-tabs` — pill-style sub-nav for grouped pages

**Data (1):**
- `activity-badges` — counter-driven achievement engine

**UI / dev tools (1):**
- `privacy-screenshot` — floating widget combining CSS-blur (media + PII), tap-to-blur picker and one-click PNG screenshot via html-to-image with full-page mode and MSE-video / broken-image fallbacks

### Changed

- `README.md` — added a Requirements section, updated module count (41 → 57), listed elite-hub as a source project, added badges (license, Next.js, TypeScript, module count, stars, last commit)
- Repository made public on GitHub

### Added (meta)

- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- Issue templates: bug, feature request, new module proposal
- PR template

## 2026-05-03

### Added

Initial library — 41 modules + 2 templates extracted from these source projects:

- **elitemess** (chat app) — 16 modules: `authentication`, `user-profiles`, `admin-panel`, `presence-system`, `channel-management`, `live-chat`, `direct-messaging`, `bookmarks`, `message-pinning`, `message-search`, `mention-autocomplete`, `link-preview`, `social-feed`, `file-upload-storage`, `auto-share-folder-watcher`, `apk-management`
- **elitestore** (app store) — 11 modules: `auth-nextauth`, `app-catalog-core`, `asset-serving-with-auth`, `version-management`, `admin-metadata-crud`, `markdown-content-renderer`, `app-card-components`, `category-filter`, `file-download-with-logging`, `catalog-browser-pages`, `app-detail-page`
- **dashboard** (Swedish small-business management) — 5 Drizzle modules: `customer-register`, `article-catalog-with-pricing`, `repair-receipt-workflow`, `company-register-with-vat-lookup`, `biltema-product-lookup`
- **elitetube** (self-hosted media) — 5 modules: `ytdlp-wrapper`, `media-utils`, `video-player-toolkit`, `pin-content-gate`, `playlist-import-job`
- **tidsrapport** (Swedish payroll) — 4 modules: `time-entry-crud`, `swedish-tax-holidays`, `tabular-pdf-generator`, `claude-vision-image-parser`

Plus 2 scaffolds under `templates/`.
