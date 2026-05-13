# swedish-tax-holidays

Two unrelated-but-useful Swedish-locale things bundled together:

1. **Tax-table lookup** — Skatteverket's monthly income-tax tables for 2025 and 2026, columns 29-42 (normal employment income, under 66, with jobbskatteavdrag).
2. **Public holidays** — pure-function calculator for every Swedish röd dag and half-day for any year (Easter via Computus, Midsummer Friday, All Saints Saturday, fixed-date holidays, plus halvdagar).

## What's included

- `lib/tax-lookup.ts` — `lookupMonthlyTax`, `getTableNumber`, municipality helpers
- `lib/holidays.ts` — `getHolidays`, `isRedDay`, `isHalfDay`, `isDayBeforeRedDay`
- `data/tax-data-2025.json` (324 KB), `data/tax-data-2026.json` (324 KB) — Skatteverket exports
- `data/municipalities-2026.json` (20 KB) — every Swedish kommun + tax rate + table number
- `api/holidays.ts` — *optional* `GET /api/holidays?year=2026`
- `api/municipalities.ts` — *optional* `GET /api/municipalities`

## Tax lookup

```ts
import {
  lookupMonthlyTax,
  getTableNumber,
  getMunicipalityTable,
  getMunicipalityList,
} from "@/lib/tax-lookup";

// Direct lookup with a known table number
lookupMonthlyTax(35000, 33);          // → 7456 (kr tax for table 33)
lookupMonthlyTax(35000, 33, 2025);    // pin to a specific year

// From a municipal tax rate to the right table number
getTableNumber(33.27);                // → 33

// From a municipality name
getMunicipalityTable("Stockholm");    // → 32 (or whatever the latest table is)

// Full dropdown list
getMunicipalityList();                // → [{ name, taxRate, tableNumber }, ...]
```

The lookup handles:
- Fixed brackets up to ~80 000 kr/month (exact lookup row)
- Rate-based brackets above that (income × rate / 100)
- Fallback to the highest rate for very high incomes

## Holidays

```ts
import {
  getHolidays,
  isRedDay,
  isHalfDay,
  isDayBeforeRedDay,
} from "@/lib/holidays";

getHolidays(2026);
// [
//   { date: "2026-01-01", name: "Nyårsdagen", halfDay: false },
//   { date: "2026-01-06", name: "Trettondedag jul", halfDay: false },
//   ...
//   { date: "2026-12-31", name: "Nyårsafton", halfDay: true },
// ]

isRedDay("2026-12-25");          // → true
isHalfDay("2026-12-24");         // → true
isDayBeforeRedDay("2026-12-24"); // → true (next day is juldagen)
```

Sundays are also treated as red days by `isRedDay`. The half-days included are: Skärtorsdagen, Midsommarafton, Julafton, Nyårsafton.

## Updating tax tables

The 2025 + 2026 tables are bundled. To add a new year:

1. Get Skatteverket's PDF for column 1, table 29-42.
2. Run a parser (see `tidsrapport/scripts/parse-tax-tables.ts` for an example) → JSON in the same shape as `tax-data-2026.json`.
3. Drop it in `data/` and register in `tablesByYear` in `lib/tax-lookup.ts`.

## Locale lock-in

This module is **only useful for Swedish payroll**. The tax tables, holidays, and municipality list are all Sweden-specific. Drop the JSON files and it's not transferable.

## Customization

- **Pre-2025 / post-2026** — drop in additional yearly JSON files and update `tablesByYear`.
- **Tax tables 29-42 only** — Skatteverket has more (sjömän, äldre arbetstagare). The bundled set is column 1 only.
- **Holidays** — full set is included; nothing to customise unless Sweden adds a new holiday.
