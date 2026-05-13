# instagram-mirror

Mirror public Instagram profiles into your local photo gallery. Designed to feed the `photo-gallery` module so mirrored items appear alongside your own uploads.

## How it works

- Each tracked profile has a row in `instagram_profiles`
- `syncProfile(username)` tries `yt-dlp` first (best for posts and reels), then falls back to `gallery-dl` if yt-dlp can't see the post
- Media lands in `PHOTOS_ROOT/<username>/`
- A daily cron polls every saved profile and downloads new posts only

## Features

- Public profile browser at `/instagram`
- Manage view (`/instagram/manage`) for adding/removing tracked profiles and forcing a sync
- Cookie support for accounts that follow private profiles (`IG_COOKIES_PATH`)
- Soft-delete: a profile can be paused without removing its cached media
- The `delete-all-videos` route is a privacy/cleanup helper that empties cached video files but keeps the metadata

## Install

```bash
cp lib/instagram.ts <app>/src/lib/
cp -r api/* <app>/src/app/api/instagram/
cp -r components/* <app>/src/app/instagram/
cp db/schema.sql <app>/db/migrations/034_instagram_profiles.sql
sqlite3 data/app.db < <app>/db/migrations/034_instagram_profiles.sql

# System dependencies — install on the host (or include in your Dockerfile)
pip install yt-dlp gallery-dl

# Daily cron
sudo cp lib/cron-sync.sh /etc/cron.daily/instagram-sync
sudo chmod +x /etc/cron.daily/instagram-sync
```

## Requires

- `yt-dlp` and `gallery-dl` available where the sync runs
- `photo-gallery` module (mirrored media shows up via the gallery's filesystem scan)
- `authentication` module

## Provides

`@/lib/instagram` exports `listProfiles`, `addProfile`, `syncProfile`, `syncAll`.
