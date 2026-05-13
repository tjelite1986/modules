# photo-gallery

A self-hosted, Google-Photos-style media library.

## Features

- **Timeline** — chronological view of every uploaded photo and video grouped by day
- **Albums** — manual albums with custom thumbnails, ordering and per-album share links
- **Smart albums** — saved filter combos (date range, rating, tags) that auto-populate
- **Map view** — Leaflet markers + heat layer for geotagged items
- **Trips** — auto-grouped clusters of items in the same place/time window
- **Year in review** — `/gallery/year/<year>` rolls up a year's highlights
- **Tags** — manual + auto (year tags, place tags, EXIF camera make)
- **Share links** — opaque per-album or per-item tokens for public read-only access
- **EXIF + geotag** — auto-extract on upload, manual override per item
- **Content-hash dedup** — SHA-256 hash, "find duplicates" route
- **Trash / restore / purge** — soft-delete with periodic purge
- **Rating** — 1–5 stars, filterable
- **Memories** — "on this day" feature endpoint

## How it works

- Items are stored on disk under `GALLERY_ROOT`, organised as `<yyyy>/<mm>/<file>`
- Thumbnails are generated on demand and cached next to the original (`<file>.thumb.jpg`)
- The DB only holds metadata (path, EXIF, tags, album membership, geotag, hash)
- Lightbox supports keyboard nav, rotate, share-link generation, geotag edit and rating
- Map uses OpenStreetMap tiles with marker clustering for >100 items

## Install

See [module.json](./module.json) for the full file mapping. Quick summary:

```bash
# Copy files
cp -r api/* <your-app>/src/app/api/gallery/
cp -r components/* <your-app>/src/app/gallery/
cp lib/gallery.ts lib/galleryStorage.ts <your-app>/src/lib/
cp db/schema.sql <your-app>/db/migrations/021_gallery.sql

# Install npm deps
npm install better-sqlite3 exifr leaflet react-leaflet \
            leaflet.heat leaflet.markercluster html-to-image \
            react-easy-crop archiver lucide-react

# Run the migration
sqlite3 data/app.db < db/migrations/021_gallery.sql
```

## Requires

- `authentication` module (or any module that exposes `verifyToken(req)` returning a user)
- An on-disk file store mounted at `GALLERY_ROOT`

## Provides

Server-side library `@/lib/gallery` exporting:
- `listItems`, `getItem`, `addItem`, `updateItem`, `deleteItem`
- `listAlbums`, `createAlbum`, `addToAlbum`, `setAlbumThumb`
- `listSmartAlbums`, `runSmartAlbumQuery`
- `listTrips`, `refreshTrips`
- `searchItems`, `getMemoriesForDate`
- `findDuplicates`, `purgeTrash`

Client pages under `/gallery/*` are the reference UI. Adapt `GalleryClient.tsx` to your design system as needed.
