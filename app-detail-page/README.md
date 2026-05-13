# app-detail-page

Detail page template for a single catalog entry. Composes most other catalog modules — useful as a working reference but expect to fork it.

## What's included

- `components/AppDetail.tsx` — the main detail component (header, install buttons, sections)
- `components/Screenshots.tsx` — lightbox-style screenshot carousel with keyboard navigation and swipe gestures
- `pages/app/[slug]/page.tsx` — route at `/app/<slug>` for `type=apps`
- `pages/game/[slug]/page.tsx` — route at `/game/<slug>` for `type=games`

## Dependencies

- **app-catalog-core** (data via `readEntry`, `decodeSlug`)
- **version-management** (`<VersionList>`)
- **markdown-content-renderer** (`<Markdown>` for the body)
- **catalog-browser-pages** (`<Header>`)
- `lucide-react`

## Layout

```
[ Header ]
[ Logo ] [ Name + developer + tagline + meta + Install buttons ]
[ Screenshots row ]                              ← clickable → lightbox
[ About: short description + markdown body ]
[ Tags ]
[ Versions ]                                     ← from VersionList module
```

## Install button logic

`pickInstallables(files)` filters the latest version's files to APK/XAPK/APKS/OBB/ZIP, then keeps the largest file per architecture (in case there are multiple). One Install button per architecture, sorted `arm64 > arm32 > x86_64 > x86 > universal`. If only one arch is present, the architecture label is dropped.

## Screenshots lightbox

- Click thumbnail → opens lightbox
- `Esc` closes
- `Left/Right` arrows navigate
- Swipe (touch) navigates
- Click backdrop closes

## Customization

- **Section order**: rearrange in `AppDetail.tsx`
- **Tag rendering**: currently `#tag` chips — easy to make them clickable to a `/tag/<x>` route
- **Install button styling**: `bg-indigo-600` accent
- **Lightbox UI**: in `Screenshots.tsx`

## Limitations

- No "Related apps" section (would need a recommendation algorithm)
- No reviews/ratings
- No "Last updated" / changelog rendering — could be added by reading a `CHANGELOG.md` per version
