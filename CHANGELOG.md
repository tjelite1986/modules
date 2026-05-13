# Changelog

All notable changes to the modules library are tracked here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The library is rolling — there are no release tags. Each module carries its own `version` field in `module.json`; entries here describe what changed at the library level.

## [Unreleased]

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
