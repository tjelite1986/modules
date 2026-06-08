# tjelite1986/modules

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Modules](https://img.shields.io/badge/modules-60-violet)](./registry.json)
[![GitHub stars](https://img.shields.io/github/stars/tjelite1986/modules?style=flat&logo=github)](https://github.com/tjelite1986/modules/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/tjelite1986/modules)](https://github.com/tjelite1986/modules/commits/main)

[![Stargazers](https://img.shields.io/github/stars/tjelite1986/modules?style=social)](https://github.com/tjelite1986/modules/stargazers)

Reusable feature packages and patterns for Next.js projects. Built for personal reuse across many projects (chat apps, store, dashboard, time tracking, media library, ...) — extracted from real, shipping code, not designed in a vacuum.

## Table of contents

- [Requirements](#requirements)
- [Two kinds of things in here](#two-kinds-of-things-in-here)
- [Repository layout](#repository-layout)
- [Install a module](#install-a-module-manual-cli-coming-later)
- [Adapt a template](#adapt-a-template)
- [Conventions](#conventions)
- [Categories](#categories)
- [Source projects](#source-projects)
- [Roadmap](#roadmap)
- [Related projects](#related-projects)
- [Changelog](./CHANGELOG.md)
- [License](#license)

> **60 modules + 2 templates** at the time of writing (one — `tiktok-mirror` — is deprecated and folded into `clips-library`). Everything is plain TypeScript, Next.js 14 App Router, Drizzle or raw `better-sqlite3`, NextAuth or hand-rolled JWT, Tailwind. No build step — copy files and go.

## Requirements

To drop these modules into your own project, you need:

| | Version | Why |
|---|---|---|
| **Node.js** | 18+ (20+ recommended) | Runtime |
| **TypeScript** | 5+ | Every `.ts` / `.tsx` file |
| **Next.js** | 14, App Router | API routes use `route.ts`, components rely on `"use client"` directives |
| **React** | 18+ | Server + client components |
| **Tailwind CSS** | 3+ | All UI components ship with Tailwind classes |
| **better-sqlite3** | 9+ | Most DB-bearing modules. A few Drizzle modules also include a Drizzle schema |
| **socket.io** | 4+ | Only needed for `live-chat`, `presence-system`, `direct-messaging`, `notification-bell` |

These modules **do not** work as-is with: Pages Router, Astro, SvelteKit, Remix, Nuxt, Express-only, Django, Rails. The patterns and SQL schemas could be ported, but the React components and route handlers are Next-App-Router-specific.

## Two kinds of things in here

| | Modules (`./`) | Templates (`./templates/`) |
|---|---|---|
| **What** | Complete, working features | Patterns / scaffolds |
| **How you use** | Copy files per `module.json`, install deps, done | Copy files, sed-replace `{{ENTITY}}` placeholders, adapt |
| **Coupling** | Self-contained | Generic — needs adaptation per concrete entity |
| **Examples** | `live-chat`, `customer-register`, `ytdlp-wrapper` | `transaction-crud-template`, `background-job-template` |

## Repository layout

```
modules/                          (= repo root)
├── README.md                     ← you are here
├── registry.json                 ← machine-readable module index
├── registry.schema.json
├── _template/                    ← skeleton for new modules
├── <module-name>/                ← one folder per module
│   ├── module.json               ← deps, file mapping, env vars, contracts
│   ├── README.md                 ← what it does + manual install steps
│   ├── api/                      ← Next.js App Router routes
│   ├── components/               ← React .tsx components
│   ├── db/                       ← schema.ts (Drizzle) and/or schema.sql (raw)
│   ├── lib/                      ← helpers, clients
│   └── hooks/                    ← React hooks
└── templates/                    ← scaffolds (sibling category)
    ├── registry.json
    ├── _template/
    └── <template-name>/
```

## Install a module (manual; CLI coming later)

1. Open `<module>/README.md` and `<module>/module.json`.
2. Install npm dependencies listed in `dependencies.npm`.
3. Copy each entry in `files[]` to its `to:` path in your project.
4. Set any `envVars` in your `.env.local`.
5. Run any `postInstall` steps from the README.

## Adapt a template

1. `cp -r templates/<template-name> /tmp/scaffold`
2. Run the `sed` command from the template's README to replace `{{ENTITY}}` / `{{entity}}` / `{{entities}}` placeholders.
3. Move the substituted files into your project at the paths in `module.json`.

## Conventions

- **All code is English.** Even when the source project was Swedish-domain (kvitto / faktura / kundnummer), names were translated for portability.
- **`module.json` is the contract.** Each one declares: framework version, npm deps, module deps, file mapping (from → to), env vars, `providesContract` (exports + endpoints + components), `postInstall` steps. A future CLI can parse it.
- **Drizzle and raw better-sqlite3 are both supported.** Drizzle modules carry an `orm: "drizzle"` field and ship both `db/schema.ts` (Drizzle) and `db/schema.sql` (raw fallback).
- **`auth-nextauth` is the default auth dependency** for new modules. Drop the auth check or swap to `authentication` (JWT + invite codes) per project.

## Categories

- **auth**: `authentication`, `auth-nextauth`, `user-profiles`, `admin-panel`, `pin-content-gate`
- **chat**: `live-chat`, `direct-messaging`, `bookmarks`, `message-pinning`, `message-search`, `mention-autocomplete`, `link-preview`
- **data/realtime**: `presence-system`, `channel-management`, `social-feed`, plus all CRUD modules
- **files**: `file-upload-storage`, `auto-share-folder-watcher`, `apk-management`, `file-download-with-logging`, `asset-serving-with-auth`
- **catalog/store**: `app-catalog-core`, `app-card-components`, `app-detail-page`, `catalog-browser-pages`, `category-filter`, `version-management`, `admin-metadata-crud`
- **business**: `customer-register`, `article-catalog-with-pricing`, `repair-receipt-workflow`, `company-register-with-vat-lookup`, `biltema-product-lookup`
- **media**: `ytdlp-wrapper`, `media-utils`, `video-player-toolkit`, `playlist-import-job`
- **time/payroll**: `time-entry-crud`, `swedish-tax-holidays`, `tabular-pdf-generator`
- **ui/content**: `markdown-content-renderer`
- **other**: `claude-vision-image-parser`

See `registry.json` for the full machine-readable list.

## Source projects

Modules were extracted from these real apps:

| Source | Modules contributed |
|---|---|
| [`elite-hub`](https://github.com/tjelite1986/elite-hub) (self-hosted personal hub) | 16 — photo-gallery, clips, tiktok-mirror, instagram-mirror, web-push, stories, follows, transcoder pipeline, notification bell, PWA, adults-pin, activity-badges, avatar upload, section-tabs, dashboard-shell, privacy-screenshot |
| `elitemess` (chat app) | 16 — auth, chat, presence, files, social feed |
| `elitestore` (app store) | 11 — auth-nextauth, catalog, asset serving, downloads, browse pages |
| `dashboard` (Swedish small-business mgmt) | 5 (Drizzle) — customer/company/article/repair register + Biltema lookup |
| `elitetube` (self-hosted media) | 5 — yt-dlp wrapper, media utils, player toolkit, PIN gate, playlist import |
| `tidsrapport` (Swedish payroll) | 4 — time entries, tax/holidays, PDF generator, Claude Vision parser |

## Roadmap

Rolling — open an issue if you want to weigh in on priorities or propose a module.

### Shipping next

- **`npx <cli> add <module>` flow** — read a module's `module.json`, fetch the files from this repo, write them at the right paths in the consumer project. Same idea as `shadcn`. Design lives in `PLAN-cli-2026-05-03.md` (kept private; ask if you want a copy).
- **Drizzle ports of the raw-SQL modules** — keep both schemas side by side per module (Drizzle migrations + `db/schema.sql` fallback)

### Exploring

- **Module versioning + a CHANGELOG per module** — right now versions live in each `module.json` but bumps aren't tracked anywhere. A per-module `CHANGELOG.md` would help consumers decide when to update
- **Compatibility matrix** — generate a table of which modules pair cleanly with which others, derived from `dependencies.modules` in `module.json`
- **Live preview pages** — for UI modules, a `/preview/<module>` route in [elite-hub](https://github.com/tjelite1986/elite-hub) that mounts the component in isolation
- **Snapshot tests** — minimal Vitest snapshots of generated UI to catch unintended regressions across module updates

### Wishlist (not committed)

- Auto-extract new modules from elite-hub via a script that reads markers in the source
- Federation: a `modules.json` index that other people's module libraries can publish, with a CLI command that can pull from any compatible source
- Cost-aware modules — opt-in tagging of which modules call paid APIs and rough cost-per-request

## Related projects

- **[elite-hub](https://github.com/tjelite1986/elite-hub)** — self-hosted personal hub running on Next.js 14, Docker + Traefik. The reference / live showcase that 16 of the modules here were extracted from. Look there to see `photo-gallery`, `clips-library`, `tiktok-mirror`, `web-push-vapid`, `dashboard-shell`, `privacy-screenshot` and others composed into one working app.

## License

MIT
