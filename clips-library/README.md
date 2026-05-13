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

## Install

```bash
cp lib/clips.ts lib/clipComments.ts lib/clipStats.ts lib/clipSlugs.ts <app>/src/lib/
cp -r components/* <app>/src/app/videos/clips/
cp -r api/* <app>/src/app/api/clips/
cp db/schema.sql <app>/db/migrations/014_clips.sql
sqlite3 data/app.db < <app>/db/migrations/014_clips.sql
```

## Requires

- `authentication` module
- A host directory mounted at `CLIPS_ROOT`

## Provides

`@/lib/clips` exports `listClips`, `getClip`, `listProfileSummaries`, `isValidProfile`, `slugForFile`.
