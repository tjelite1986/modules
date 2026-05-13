# catalog-browser-pages

Reference pages and supporting components for browsing the catalog. More of a starter template than a black-box module — fork it.

## What's included

**Components:**
- `Header` — sticky nav with logo, desktop nav, search bar, admin link, user avatar
- `Section` — titled section wrapper with optional "See all" link
- `EmptyState` — icon + title + description + optional action
- `CatalogGrid` — client-side filterable grid (combines CategoryFilter + AppRowCard)

**Pages:**
- `pages/home/page.tsx` → `app/page.tsx` — hero + suggested + top picks + new apps + new games
- `pages/apps/page.tsx` → `app/apps/page.tsx` — type listing with category filter
- `pages/search/page.tsx` → `app/search/page.tsx` — full-text search across name/slug/developer/category/tagline/description/tags

## Dependencies
- **app-catalog-core** (data)
- **app-card-components** (cards)
- **category-filter** (filter pills)
- **auth-nextauth** (Header reads `useSession()` for the user avatar/admin link)

## Search algorithm

Substring match on a joined haystack — fast for hundreds of entries, slow for tens of thousands. Replace with FTS5 / Postgres full-text / Meilisearch when you outgrow it.

## Customization

- **Brand**: `<Header brand="Your Name" />` (default "Catalog")
- **Nav items**: edit `desktopNav` in `Header.tsx`
- **Home sections**: open `pages/home/page.tsx` and rearrange — the data slicing (recent, suggested, featured) is at the top of the file
- **/games page**: not included — copy `apps/page.tsx`, change `listType("apps")` to `listType("games")`, change the title
- **Account page**: not included (was elitestore-specific) — write your own at `app/account/page.tsx`

## Limitations

- These are reference implementations. Real apps almost always need to fork them
- The home page randomizes the "Suggested for you" order on every render (`Math.random() - 0.5`) — fine for small catalogs, terrible for SEO. Replace with a stable shuffle if you index this content
