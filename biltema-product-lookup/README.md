# biltema-product-lookup

Adapter around Biltema's public typeahead API. Three endpoints:

- **lookup** — fetch one article by number (public; no auth)
- **search** — full-text query with up to 50 results (auth required)
- **random** — sample of products across many categories (auth required, optional)

Useful for retail/repair/inventory apps that resell or reference Biltema items.

## What's included

- `lib/biltema.ts` — `fetchBiltemTerm`, `flattenDocuments`, helper types
- `api/lookup.ts` — `GET /api/biltema/lookup?article_number=...`
- `api/search.ts` — `GET /api/biltema/search?q=...&take=20`
- `api/random.ts` — `GET /api/biltema/random?count=20` (optional)

## Endpoints

```bash
# Single article (public, cached 1 hour)
GET /api/biltema/lookup?article_number=803700
→ { "name": "...", "price": 39 }

# Search (signed-in, cached 5 min)
GET /api/biltema/search?q=skiftnyckel&take=20
→ { "total": 150, "results": [{ articleNumber, name, price, category, description }, ...] }

# Random sample (signed-in, never cached)
GET /api/biltema/random?count=20
→ [{ articleNumber, name, price, category, description }, ...]
```

## How the adapter works

`fetchBiltemTerm()` calls `https://find.biltema.com/v3/web/typeahead/100/sv/<term>?IsFilterEnabled=true&Take=N` and runs the response through `flattenDocuments()`, which expands `articleData` arrays into individual rows and strips HTML from descriptions.

```ts
import { fetchBiltemTerm } from "@/lib/biltema";

const items = await fetchBiltemTerm("hammare", {
  cache: "revalidate",
  revalidateSeconds: 300,
  take: 20,
});
```

## Caveats

- **Unofficial API** — no published contract. Biltema can change or rate-limit at any point.
- **Swedish only** — the path locks in `/sv/`. Modify `BILTEMA_BASE` for other locales.
- The random endpoint hits the API 4× per call with `cache: "no-store"`. Use sparingly.

## Dependencies on other modules

- `auth-nextauth` — used by `search.ts` and `random.ts` for session checks (optional; remove the auth check if you want them public too).

## Customization

- **Auth boundary** — `lookup` is public so it can power autocomplete; `search`/`random` are gated. Adjust per your app.
- **Term list** — `random.ts` ships with a Biltema-flavoured term bank. Edit it to bias toward your inventory.
- **Caching** — Next.js `revalidate` is used; swap for KV / Redis if you have heavier traffic.
