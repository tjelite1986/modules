# app-catalog-core

Filesystem-based catalog for versioned apps/games (or any kind of versioned content). The catalog auto-discovers entries by scanning a directory tree — no database for the catalog itself, just folders.

## Folder convention

```
$STORE_ROOT/
├── apps/                       (one of TYPES)
│   └── My App/                 <- slug = folder name (allows spaces, parens, etc.)
│       ├── assets/
│       │   ├── info.md         <- frontmatter metadata + markdown body
│       │   ├── logo.png        <- or .jpg/.jpeg/.webp, or icon.png
│       │   ├── banner.jpg      <- or .png/.jpeg/.webp, or feature.png
│       │   └── screenshots/    <- any .png/.jpg/.webp/.gif
│       │       ├── 1.png
│       │       └── 2.png
│       └── versions/
│           ├── 1.0.0/
│           │   ├── app-arm64.apk
│           │   ├── app-arm32.apk
│           │   └── app-x86_64.apk
│           └── 1.1.0/
│               └── app-arm64.apk
└── games/                      (the other type)
    └── ...
```

No database inserts needed — just drop files in. The library scans on every request (no cache; SQLite or in-memory cache is easy to bolt on if you need it).

## info.md format

```markdown
---
name: My Application
developer: Acme Inc.
category: Productivity
tagline: Best app ever
description: Longer description used for cards and search
tags:
  - work
  - office
website: https://example.com
---

# Long markdown body

Anything below the frontmatter is the long description, returned as `meta.body`.
```

## Architecture detection

The library detects Android architecture from the filename (or from the version-folder suffix like `1.0.0-arm64`):

| Pattern | Arch |
|---------|------|
| `arm64`, `arm64-v8a`, `aarch64`, `armv8` | `arm64` |
| `armeabi-v7a`, `armv7`, `arm32` | `arm32` |
| `x86_64` | `x86_64` |
| `x86` (boundary-anchored) | `x86` |
| anything else | `universal` |

Use `ARCH_LABELS[arch]` to render human-readable labels.

## Dependencies

- `gray-matter@^4.0.3` (frontmatter parsing)
- No other modules required

## Installation

```bash
npm install gray-matter@^4.0.3
mkdir -p $STORE_ROOT/apps $STORE_ROOT/games
```

Set `STORE_ROOT` in `.env.local` (defaults to `./store`).

## Usage

```ts
import { listType, readEntry, formatBytes } from "@/lib/store";

// List everything in /apps
const apps = listType("apps");
// → AppEntry[] sorted by meta.name

// Read a single entry by slug
const entry = readEntry("apps", "My App");
if (entry) {
  console.log(entry.meta.name, entry.latest?.version);
  for (const file of entry.latest?.files ?? []) {
    console.log(`  ${file.arch}: ${file.name} (${formatBytes(file.size)})`);
  }
}
```

## Customization

- **Categories (TYPES)**: hard-coded as `["apps", "games"]`. Change in `store.ts` if you want e.g. `["plugins", "themes"]`.
- **Allowed file extensions**: `APK_EXT_RE` in `store.ts` lists `apk`, `xapk`, `apks`, `obb`, `zip`. Extend for other types (`exe`, `dmg`, etc.).
- **Slug pattern**: `isValidSlug` allows letters, digits, spaces, and `._-(){}[]+&!',`. Tighten or loosen as needed.

## Limitations

- No caching — every `listType()` walks the disk. For large catalogs (1000+ entries) wrap with `unstable_cache` or your own cache layer.
- No write API — for that, add the `admin-metadata-crud` module.
- Path security relies on `isValidSlug` and `isValidFileName`. Don't bypass them.
