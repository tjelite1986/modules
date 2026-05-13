# repair-receipt-workflow

Service/repair receipts with a 4-step status workflow. Built for a workshop counter where items come in, get worked on, get marked ready, and finally get picked up by the customer.

## What's included

- `db/schema.ts` — Drizzle table for `repair_receipts`
- `db/schema.sql` — equivalent raw SQL
- `lib/repair-receipts.ts` — `generateReceiptNumber`, `STATUS_TRANSITIONS`, `canTransition`
- `api/route.ts` — `GET / POST / PATCH /api/repair-receipts`

## Schema highlights

```ts
repair_receipts (
  id, user_id,
  receipt_number,                           // auto-generated <year>-<6 digits>
  intake_date,

  customer_name, customer_email, customer_phone,
  customer_address, customer_postal_code, customer_city,
  ssn, customer_number,                     // denormalised; can pair with customer-register

  receipt_issuer,                           // who took it in (filled from session)
  original_receipt_number,                  // for warranty cross-reference
  warranty,                                 // boolean
  inspection_requested,                     // boolean

  store, store_city,                        // optional

  article_number, item_name,
  fault_description, action, technician,
  max_cost, action_date, comments,

  status,                                   // intake | in_progress | ready | picked_up
  created_at
)
```

## Status workflow

```
intake ── in_progress ── ready ── picked_up
                          │
                          └── (rollback to in_progress)
```

`canTransition(from, to)` validates a status change. Wire this into your PATCH handler if you want strict enforcement — by default the route accepts any status update.

## Permissions

The list endpoint shows **all receipts to admins** and **only own receipts to regular users** (filtered on `user_id`). Adjust if you have a more granular permission model.

## Dependencies on other modules

- `auth-nextauth` — provides `authOptions` and `session.user.role`.

## Customization

- **Customer fields are denormalised** — every receipt carries a copy of customer info. Pair with `customer-register` and join via `customer_number` if you want normalisation.
- **Number format** — `generateReceiptNumber()` returns `2024-123456`. Override for sequential numbers, branch prefixes, etc.
- **Status set** — fixed at 4 values; edit the schema enum and `STATUS_TRANSITIONS` together if you need more steps.
