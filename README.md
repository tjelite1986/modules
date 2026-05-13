# tjelite1986/modules

Reusable feature packages and patterns for Next.js projects. Built for personal reuse across many projects (chat apps, store, dashboard, time tracking, media library, ...) — extracted from real, shipping code, not designed in a vacuum.

> **57 modules + 2 templates** at the time of writing. Everything is plain TypeScript, Next.js 14 App Router, Drizzle or raw `better-sqlite3`, NextAuth or hand-rolled JWT, Tailwind. No build step — copy files and go.

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

## Toward a CLI

The roadmap is a `npx <cli> add <module>` flow that reads a module's `module.json`, fetches the files from this repo, and writes them at the right paths in the consumer project — same idea as `shadcn`. Until then, manual copy works.

## License

MIT
