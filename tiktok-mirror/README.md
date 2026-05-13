# tiktok-mirror

Follow TikTok profiles and watch them locally. Metadata is polled daily via yt-dlp; videos themselves are lazy-downloaded only when someone hits play.

## Why lazy download

A typical TikTok profile has hundreds of clips. Eagerly downloading every video uses tens of GB of disk and bandwidth for content nobody will watch. This module:

1. Polls profile metadata (titles, IDs, thumbnails) daily — cheap
2. Stores a placeholder DB row per video
3. Downloads the actual `.mp4` only when a user clicks play
4. Subsequent watches stream the cached file

## Features

- Per-profile feed at `/videos/tiktok/<username>`
- Auto-import: `/api/tiktok/import` accepts a profile URL
- Daily auto-poll via cron with `SYNC_TOKEN` auth
- Comments and like/view counters per video
- Poster generation from yt-dlp `--write-thumbnail`
- Fullscreen vertical feed integration (sortable with `clips-library` items)

## Install

```bash
cp lib/tiktok*.ts <app>/src/lib/
cp -r api/* <app>/src/app/api/tiktok/
cp -r components/* <app>/src/app/videos/tiktok/
cp db/schema.sql <app>/db/migrations/017_tiktok.sql
sqlite3 data/app.db < <app>/db/migrations/017_tiktok.sql

# Cron (host-side) — runs daily at 6am via /etc/cron.daily/
sudo cp lib/cron-sync.sh /etc/cron.daily/tiktok-sync
sudo chmod +x /etc/cron.daily/tiktok-sync
```

Then edit `/etc/cron.daily/tiktok-sync` to point `ELITE_URL_BASE` at your hostname and `ELITE_ENV_FILE` at the `.env` containing `SYNC_TOKEN`.

## Requires

- `yt-dlp` available on the host (or inside the container that handles downloads)
- `clips-library` module (TikTok videos share the unified video feed sort logic)
- `authentication` module

## Provides

`@/lib/tiktok` exports `listProfiles`, `addProfile`, `syncProfile`, `listVideosForProfile`, `getVideo`, `downloadVideo`.
