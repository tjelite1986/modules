# file-upload-storage

Generic file upload, storage, and serving for Next.js. Supports images, videos, and documents. HTTP Range for large videos (seek). HEIC->JPEG conversion. Custom folders with thumbnails.

## What's included

**Server lib:**
- `lib/uploadPaths.ts` — `getUploadsRoot`, `getSubDir`, `getUploadPath`, `getAvatarsDir`, `getChannelAssetsDir`
- `lib/heicConvert.js` — `convertHeicIfNeeded` (requires `heic-convert`)

**API:**
- `POST /api/upload` — generic upload (auto-routes to photo/video/files/apk)
- `GET /api/uploads/[filename]` — serve a file with MIME, Cache-Control, and Range
- `GET /api/files?dir=X` — list files in a folder
- `POST /api/files/upload?dir=X` — upload to a specific folder
- `GET /api/folders` — list builtin + custom folders (with autoshare config)
- `POST /api/folders` — create a custom folder
- `PATCH/DELETE /api/folders/[id]` — update/delete
- `POST/GET /api/thumbs` — save/get thumbnails

## Dependencies
- **authentication** (required)

## Installation

```bash
npm install heic-convert@^2.1.0
sqlite3 data/app.db < db/migrations/009_files.sql
mkdir -p $UPLOADS_DIR && chmod 777 $UPLOADS_DIR
```

## Env

- `UPLOADS_DIR` — absolute path where files are stored
- `DATA_DIR` — fallback base directory (`<DATA_DIR>/uploads`)

## Folder structure that gets created

```
$UPLOADS_DIR/
├── photo/      # images (auto via /api/upload)
├── video/      # videos
├── apk/        # APK packages
├── files/      # documents (default fallback)
├── tiktok/     # custom builtin for TikTok
├── avatars/    # user profile pictures
├── channel-assets/  # channel banner/icons
├── thumbs/     # video thumbnails
└── <custom>/   # user-defined folders
```

## HEIC conversion

iPhone photos arrive as HEIC, which browsers don't support. The module converts them to JPEG on upload (requires the `heic-convert` package). The original file is removed.

## HTTP Range

`/api/uploads/[filename]` supports `Range` headers, so video players can start playing immediately and seek without loading the whole file.

## Limitations

- Max 1 GB per file (hard-coded in `MAX_SIZE`)
- Allowed types: jpg/jpeg/png/gif/webp/heic/heif/mp4/mov/pdf/doc/docx/txt/zip/apk
- `heic-convert` has C++ deps — in Docker, use a multi-stage build
