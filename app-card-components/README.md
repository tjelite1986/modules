# app-card-components

Five card variants for browsing a catalog plus the Install button. Use them to compose listing pages.

| Component | Layout | Best for |
|-----------|--------|----------|
| `AppCard` | Square 1:1 with logo | Dense grids ("New apps", "All apps") |
| `AppRowCard` | Horizontal: logo + meta + Install | List views, search results |
| `AppLandscapeCard` | 16:10 banner + small icon row | Horizontal scroll ("Suggested for you") |
| `HeroCard` | 16:9 banner with overlay text | Featured app at top of home |
| `InstallButton` | Pill button | Anywhere — auto-resolves to download URL |

## Dependencies

- **app-catalog-core** (uses `AppEntry` type)
- **asset-serving-with-auth** (soft — components reference `/api/asset/...` URLs)
- **file-download-with-logging** (soft — Install button points to `/api/download/...`)
- `lucide-react` for the Package fallback icon

## Usage

```tsx
import { AppCard, AppRowCard, AppLandscapeCard, HeroCard } from "@/components/AppCard";
import { listType } from "@/lib/store";

const apps = listType("apps");

// Dense grid
<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6">
  {apps.map(e => <AppCard key={e.slug} entry={e} />)}
</div>

// Horizontal scroll row
<div className="flex gap-4 overflow-x-auto snap-x">
  {apps.map(e => <AppLandscapeCard key={e.slug} entry={e} />)}
</div>

// Featured
<HeroCard entry={apps[0]} />
```

## Customization

- **Detail URLs**: `AppCard.tsx` has `detailHref(entry)` mapping `apps` → `/app/[slug]` and `games` → `/game/[slug]`. Change to whatever your route structure is.
- **Install URL**: `InstallButton` builds `/api/download/[type]/[slug]/[versionDir]/[file]`. Swap if you have a different download endpoint.
- **Empty/fallback states**: each card falls back to a `Package` icon when no logo/banner — replace with your own placeholder
- **Color**: `bg-indigo-600` accent on the Install button — swap with your brand color

## Limitations

- Components use raw `<img>` (with eslint-disable) instead of `next/image`. For production, swap to `next/image` if your asset endpoint supports the loader contract.
