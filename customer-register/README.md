# customer-register

CRUD for a customers table with flexible lookup and an optional cross-table history aggregator. Built on Drizzle + NextAuth for a Next.js 14 App Router project.

## What's included

- `db/schema.ts` — Drizzle table definition for `customers`
- `db/schema.sql` — equivalent raw SQL if you don't use Drizzle
- `lib/customers.ts` — helpers (`generateCustomerNumber`, `ssnVariants`, `composeName`)
- `api/route.ts` — full CRUD: `GET / POST / PATCH / DELETE /api/customers`
- `api/lookup.ts` — `GET /api/customers/lookup` — exact (by customer_number / phone / SSN) or partial (SSN substring)
- `api/history.ts` — **optional** — aggregates transactions across other tables for one customer

## Schema

```ts
customers (
  id, user_id,
  customer_number,
  name, first_name, last_name,
  ssn,                            // Sweden's personnummer; rename for other locales
  email, phone,
  address, postal_code, city,
  notes,
  created_at
)
```

## Lookup variants

```bash
GET /api/customers/lookup?q=C123456            # by customer number OR phone
GET /api/customers/lookup?ssn=19850612-1234    # exact SSN — matches all format variants
GET /api/customers/lookup?ssn_search=850612    # partial SSN — returns up to 10
```

`ssnVariants()` normalises across the common Swedish formats:
`8506121234`, `198506121234`, `850612-1234`, `19850612-1234`. Drop or replace this helper for other locales.

## History endpoint

`api/history.ts` reads from related transaction tables and groups by customer. It expects the following Drizzle exports to exist in `lib/db/schema`:

- `salesReceipts` (with `customerNumber`, `ssn`, `createdAt`)
- `repairReceipts` (same)
- `orders` (same)
- `invoices` (same)
- `pickupOrders` (same)

If your project only has some of these, **delete the corresponding entries** from the `Promise.all` and the response object. The file is marked `optional` in `module.json` — you can skip copying it.

## Dependencies on other modules

- `auth-nextauth` — provides `authOptions` used by every route.

## Customization

- **Numbering format** — `generateCustomerNumber()` returns `C` + 6 digits of timestamp. Edit for your scheme.
- **SSN format** — `ssnVariants()` only knows Swedish 10/12-digit personnummer. Replace for other locales (or delete and use plain `eq` matching).
- **Locale field names** — schema uses generic `name / first_name / last_name`. The source project uses Swedish (`namn / fornamn / efternamn`); we translated.
- **Auth assumption** — every route requires a session. Drop the auth check if you want public read.
