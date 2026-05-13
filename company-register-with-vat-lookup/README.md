# company-register-with-vat-lookup

A B2B companies register with internal fuzzy search and an **EU VIES VAT-number lookup** that auto-fills name/org-number/address from a Swedish organisation number.

## What's included

- `db/schema.ts` — Drizzle table for `companies`
- `db/schema.sql` — equivalent raw SQL
- `lib/vat.ts` — VAT-format helpers + address parser + company-number generator
- `api/route.ts` — full CRUD `GET / POST / PATCH / DELETE /api/companies`
- `api/lookup.ts` — `GET /api/companies/lookup?q=...` — fuzzy by name/number/org-number
- `api/vat-lookup.ts` — **optional** — `GET /api/companies/vat-lookup?orgnr=...` — calls VATComply (EU VIES proxy) and returns parsed company info

## Schema

```ts
companies (
  id,
  company_number,                 // unique internal number, auto-generated
  company_name,
  organisation_number,            // formatted "556471-4474"
  address, postal_code, city,
  contact_person, phone, email,
  payment_terms, notes,
  created_at
)
```

## VAT lookup

`GET /api/companies/vat-lookup?orgnr=556471-4474` →

```json
{
  "companyName": "...",
  "organisationNumber": "556471-4474",
  "address": "...",
  "postalCode": "112 51",
  "city": "STOCKHOLM"
}
```

Backed by [VATComply](https://api.vatcomply.com/vat) which proxies the EU VIES service. Free, fair-use; cache aggressively if you hit it often.

The route is Sweden-specific (it converts a 10-digit orgnr → `SE...01` VAT format). For other EU countries you'd swap `toSwedishVatNumber` and probably the address parser as well — VIES returns differently-formatted data per country.

## Helpers

```ts
import {
  toSwedishVatNumber,        // "556471-4474" → "SE556471447401"
  formatSwedishOrgNumber,    // "5564714474"  → "556471-4474"
  parseSwedishAddress,       // VIES multiline → { address, postalCode, city }
  generateCompanyNumber,     // → "CO123456" (timestamp-based)
} from "@/lib/vat";
```

## Dependencies on other modules

- `auth-nextauth` — provides `authOptions`.

## Customization

- **Numbering** — `generateCompanyNumber()` returns `CO` + 6-digit timestamp; override for sequential numbers.
- **VAT lookup is Sweden-specific** — drop `api/vat-lookup.ts` and the SE helpers in `lib/vat.ts` if you don't need it, or replace per locale.
- **Error caching** — none built in; wrap the VIES call in `unstable_cache` or your CDN if traffic warrants.
