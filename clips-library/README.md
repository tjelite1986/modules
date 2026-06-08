# clips-library

A per-profile short-video library that reads from the filesystem and tracks engagement in SQLite.

## How it works

- Videos live under `CLIPS_ROOT/<profile>/<slug>.web.mp4` (and optional `<slug>.jpg` poster)
- `listClips()` scans the filesystem on every call — no separate ingest step
- Transcode status is derived from sibling marker files (`.web.failed`, `.web.tmp.mp4`)
- The DB only holds engagement data: likes, views, comments
- Vertical fullscreen feed sorts by `videoMtime` (newest first)

## Features

- Per-profile organisation with profile summary cards
- Auto-generated posters (use first frame if no `.jpg` exists)
- View counter, like button, comment thread per clip
- Transcode-status badge (`waiting`, `failed`, `done`)
- "Orphan `.web.mp4`" pattern: original is deleted after successful transcode, the library treats the remaining web-optimised file as the clip
- Title/description/uploader/tags read from optional `<slug>.md` sidecar (front-matter)

## Supersedes `tiktok-mirror`

Earlier versions of this set shipped a separate `tiktok-mirror` module. That module is now **deprecated**: the TikTok use-case is folded into `clips-library` via the `clip_profiles` table (see below).

## Unified profile registry

`db/schema.sql` ships two extra tables that drive the auto-poll pipeline:

| Table | Purpose |
|---|---|
| `clip_profiles` | One row per profile folder under `CLIPS_ROOT`. Columns: `name`, `display_name`, `source_url`, `source_kind`, `auto_poll`, `videos_limit`, `last_synced_at`. Manual drop-in profiles set `auto_poll=0` and `source_url=NULL`. Profiles backed by yt-dlp set `auto_poll=1` and `source_url=<user/profile URL>`. |
| `clip_profile_skipped` | Per-profile sticky skip-list. Videos deleted by the user are recorded here so the next auto-poll won't re-download them. Cleared on explicit re-download. |

`lib/clipsSync.ts` exposes the orchestration:

- `listClipProfiles()`, `listAutoPollProfiles()`, `getClipProfile(name)`
- `upsertClipProfile({ name, displayName, sourceUrl, sourceKind, autoPoll, videosLimit })`
- `setAutoPoll(name, on)`, `markProfileSyncedNow(name)`
- `markVideoSkipped(profile, videoId)` / `unmarkVideoSkipped(...)`
- `downloadSingleVideo(profile, videoUrl, videoId)` — manual-pick
- `syncClipProfile(name)` — poll one auto_poll profile
- `syncAllAutoPollProfiles()` — bulk-poll, oldest-synced first (use this from cron)
- `DEFAULT_PROFILE_VIDEOS_LIMIT = 30` — falls back here when `videos_limit IS NULL`

`videos_limit` is per-profile and the sync expands its yt-dlp window by the size of the skip-list so manual deletions never permanently shrink the local library.

## Admin drawer

`components/[profile]/ProfileAdminPanel.tsx` is a `Settings`-icon drawer that exposes:

- Toggle `auto_poll`
- Edit `source_url`, `display_name`, `videos_limit`
- Manual-pick candidates (`/api/clips/profiles/:profile/candidates` → `/api/clips/profiles/:profile/download`)
- Trigger one-shot sync (`/api/clips/profiles/:profile/sync`)

The drawer gates itself on `useAuthUser().isAdmin`. All write routes additionally enforce `verifyAdmin()` server-side.

## API

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/clips/profiles` | GET | public | list profiles |
| `/api/clips/profiles` | POST | admin | upsert profile |
| `/api/clips/profiles/:profile/sync` | POST | admin | sync one profile |
| `/api/clips/profiles/:profile/candidates` | GET | admin | preview yt-dlp results without downloading |
| `/api/clips/profiles/:profile/download` | POST | admin | download one specific video into the profile |
| `/api/clips/sync-all` | POST | admin (or SYNC_TOKEN) | bulk-poll every `auto_poll=1` profile |

## Install

```bash
cp lib/clips.ts lib/clipComments.ts lib/clipStats.ts lib/clipSlugs.ts lib/clipsSync.ts <app>/src/lib/
cp -r components/* <app>/src/app/videos/clips/
cp -r api/* <app>/src/app/api/clips/
cp db/schema.sql <app>/db/migrations/014_clips.sql
sqlite3 data/app.db < <app>/db/migrations/014_clips.sql
```

If you're upgrading from `tiktok-mirror`, migrate the `tiktok_profiles` rows into `clip_profiles` (`auto_poll=1`, `source_url=<tiktok URL>`) and point the cron at `/api/clips/sync-all`.

## Requires

- `authentication` module — `verifyAdmin` for write routes, `verifyToken` for view routes
- A host directory mounted at `CLIPS_ROOT`
- `yt-dlp` available on the host (only needed for auto-poll profiles)
- `@/lib/useAuthUser` exposing `{ isAdmin: boolean }` (consumed by `ProfileAdminPanel.tsx`)

## Provides

- `@/lib/clips` — `listClips`, `getClip`, `listProfileSummaries`, `isValidProfile`, `slugForFile`
- `@/lib/clipsSync` — see "Unified profile registry" above
