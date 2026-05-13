# transaction-crud-template

A pattern for transactional records that all share the same shape:

- **Line items** stored as a JSON array on a single column (`items`)
- A computed **totalAmount**
- A **paymentMethod** (cash | card | swish | invoice — drop / extend per project)
- A **status** enum (varies per entity — invoice has unpaid/paid/overdue, pickup-order has waiting/ready/picked-up/cancelled, etc.)
- An **issuedBy** field auto-filled from the session
- Admin sees all rows; non-admins only see their own

In the Swedish small-business dashboard this template was extracted from, the same shape powers four concrete entities: invoices (`fakturor`), sales receipts (`kvitton`), pickup orders (`köp & hämta`), and customer orders (`kundbeställningar`). Rather than ship four near-identical modules, this template captures the pattern.

## What's included

| File | Per entity? | Purpose |
|---|---|---|
| `db/schema.ts` | one copy per entity | Drizzle table definition with placeholders |
| `api/route.ts` | one copy per entity | full CRUD with auth + admin gating |
| `lib/line-items.ts` | shared (one copy total) | LineItem types + helpers, entity-agnostic |
| `components/LineItemsForm.tsx` | shared (one copy total) | line-item editor UI, entity-agnostic |

## Placeholders

| Placeholder | Replace with | Example |
|---|---|---|
| `{{ENTITY}}` | PascalCase singular | `Invoice` |
| `{{entity}}` | camelCase singular | `invoice` |
| `{{entities}}` | plural lowercase / snake_case | `invoices` |
| `{{StatusEnum}}` | TS array literal | `["unpaid", "paid", "overdue"]` |
| `{{defaultStatus}}` | quoted string | `"unpaid"` |

Quick adapt:

```bash
cp -r templates/transaction-crud-template my-app/_invoices-scaffold
cd my-app/_invoices-scaffold
find db api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/{{ENTITY}}/Invoice/g' \
  -e 's/{{entity}}/invoice/g' \
  -e 's/{{entities}}/invoices/g' \
  -e 's/{{StatusEnum}}/["unpaid", "paid", "overdue"]/g' \
  -e 's/{{defaultStatus}}/"unpaid"/g' {} +
```

## Before / after

**Schema (template):**
```ts
export const {{entities}} = sqliteTable("{{entities}}", {
  ...
  status: text("status", { enum: {{StatusEnum}} })
    .notNull()
    .default({{defaultStatus}}),
  ...
});
export type {{ENTITY}} = typeof {{entities}}.$inferSelect;
```

**Adapted to Invoice:**
```ts
export const invoices = sqliteTable("invoices", {
  ...
  status: text("status", { enum: ["unpaid", "paid", "overdue"] })
    .notNull()
    .default("unpaid"),
  ...
});
export type Invoice = typeof invoices.$inferSelect;
```

## Concrete entity examples (from the source project)

| Entity | `entities` | Status enum | Default |
|---|---|---|---|
| Invoice | `invoices` | `["unpaid", "paid", "overdue", "cancelled"]` | `"unpaid"` |
| SalesReceipt | `sales_receipts` | (no status — drop the column) | — |
| PickupOrder | `pickup_orders` | `["waiting", "ready", "picked_up", "cancelled"]` | `"waiting"` |
| Order | `orders` | `["new", "processing", "completed", "cancelled"]` | `"new"` |

The Invoice variant additionally needs a `dueDate`, `companyId`, and a few B2B-only fields. Add them to the schema after the placeholder swap — the template covers the common shape, not all the B2B specifics.

## Shared helpers

`lib/line-items.ts` is entity-agnostic:

```ts
import {
  newLineItem,           // empty draft row with crypto.randomUUID()
  parseLineItems,        // safe JSON.parse, returns LineItem[]
  calculateDraftTotal,   // sum of qty * price across draft rows
  formatCurrency,        // 1234 → "1 234 kr"
} from "@/lib/line-items";
```

`components/LineItemsForm.tsx` is a Tailwind-styled editor (responsive: card layout on mobile, grid on desktop). It accepts an `accent` colour (`emerald | purple | indigo | orange`) so you can visually distinguish entities.

## Wiring article-number autocomplete

If you have the `article-catalog-with-pricing` module installed, the `onLookup` callback can call its lookup endpoint:

```tsx
async function lookupItem(id: string, articleNumber: string) {
  if (!articleNumber.trim()) return;
  setItem(id, { lookingUp: true });
  const res = await fetch(`/api/articles/lookup?article_number=${articleNumber}`);
  const data = await res.json();
  if (data) {
    setItem(id, {
      name: data.name,
      price: String(data.price ?? ""),
      bundleQuantity: data.bundleQuantity ? String(data.bundleQuantity) : undefined,
      bundlePrice: data.bundlePrice ? String(data.bundlePrice) : undefined,
      lookingUp: false,
    });
  } else {
    setItem(id, { lookingUp: false });
  }
}
```

Same shape works with the `biltema-product-lookup` module's `/api/biltema/lookup` for an external catalog.

## Dependencies on other modules

- **Required**: `auth-nextauth` (for `authOptions`, `session.user.role`).
- **Optional**: `article-catalog-with-pricing` (for inline article autocomplete).

## Customization knobs

- **paymentMethod enum** — the four-value default is Sweden-specific; trim or extend per market.
- **Permission rules** — list filters by `userId` for non-admins, delete is admin-only. Adjust to your model.
- **Number generation** — `generateReferenceNumber()` returns `<year>-<6 digits>`. Replace with sequential, prefixed, etc.
- **Items column** — currently a single JSON column. Move to a separate `<entity>_line_items` table if you need to query against item rows directly.
