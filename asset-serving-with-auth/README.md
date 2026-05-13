# asset-serving-with-auth

Auth-gated endpoint that serves catalog assets (logo/banner/screenshots/info.md) with path-traversal protection and content-type detection.

## API

`GET /api/asset/[type]/[slug]/[...path]`

Special shortcuts (resolve through `findLogo` / `findBanner` so any of `.png`/`.jpg`/`.jpeg`/`.webp`/`icon.png`/`feature.png` works):
- `/api/asset/apps/My App/logo` — auto-finds the logo
- `/api/asset/apps/My App/banner` — auto-finds the banner

Direct path access (must match `/^[A-Za-z0-9._-]+$/` per segment, must stay inside `assetsDir`):
- `/api/asset/apps/My App/screenshots/1.png`
- `/api/asset/apps/My App/info.md`

## Dependencies

- **app-catalog-core** (uses `assetsDir`, `findLogo`, `findBanner`, `isValidType`, `isValidSlug`)
- **auth-nextauth** (gates with `getServerSession(authOptions)`)

## Security

- Each path segment validated against a strict regex
- Final resolved path is checked to stay inside `assetsDir(type, slug)` — symlink/`..` attacks blocked
- Returns 401 if no session, 400 for malformed input, 403 for traversal attempts, 404 for missing files

## Usage in components

```tsx
<img src={`/api/asset/${entry.type}/${entry.slug}/logo`} alt="" />
<img src={`/api/asset/${entry.type}/${entry.slug}/banner`} alt="" />
{entry.screenshots.map(s => (
  <img key={s} src={`/api/asset/${entry.type}/${entry.slug}/screenshots/${s}`} />
))}
```

## Customization

- **Make public** (no auth): remove the `getServerSession` check
- **Change cache policy**: `Cache-Control: private, max-age=300` (5 min) — adjust to taste
- **Add MIME types**: edit `contentTypeFor()`
