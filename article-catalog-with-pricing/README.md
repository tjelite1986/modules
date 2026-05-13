# article-catalog-with-pricing

A merchant-style article (product) catalog with **bulk pricing**: each row can carry a "X for Y" bundle deal in addition to a regular per-unit price. Includes a calculator that returns the correct effective price for any quantity.

## What's included

- `db/schema.ts` — Drizzle table for `articles`
- `db/schema.sql` — equivalent raw SQL
- `lib/pricing.ts` — `calculateEffectivePrice`, `calculateLineTotal`
- `api/route.ts` — full CRUD: `GET / POST / PATCH / DELETE /api/articles`
- `api/lookup.ts` — `GET /api/articles/lookup?article_number=...` for line-item autocomplete

## Schema

```ts
articles (
  id,
  article_number,             // unique
  name,
  price,                      // regular per-unit price
  bundle_quantity,            // e.g. 3 (units in a bundle)
  bundle_price,               // e.g. 99.00 (price for one bundle)
  category,
  description,
  created_at
)
```

## Bulk pricing model

A single bundle tier per article: "buy any multiple of N at price P, plus the rest at the regular per-unit price." Example: regular 39, bundle 3-for-99. Buying 4 units → `99 + 39 = 138`, effective per-unit `34.50`.

```ts
import { calculateEffectivePrice, calculateLineTotal } from "@/lib/pricing";

calculateEffectivePrice(4, 39, 3, 99);  // "34.50"
calculateLineTotal(4, 39, 3, 99);        // 138
```

For multi-tier deals (e.g. 3-for-99 OR 5-for-149) replace `lib/pricing.ts` — the schema does not encode multiple tiers.

## Lookup endpoint

`GET /api/articles/lookup?article_number=803700` returns just the fields needed for an inline line-items form:

```json
{ "name": "...", "price": 39, "bundleQuantity": 3, "bundlePrice": 99 }
```

Use this from a "scan article number → autofill row" UI like the one in the `transaction-crud-template`.

## Dependencies on other modules

- `auth-nextauth` — for `authOptions`.

## Customization

- **Bulk-pricing tiers** — single tier only; replace `pricing.ts` for more.
- **Currency formatting** — none here; format in the UI layer.
- **Naming** — fields use generic English (`name`, `price`); the source project used Swedish (`varunamn`, `pris`).
