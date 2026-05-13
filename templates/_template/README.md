# template-name

What pattern this template captures and when to reach for it.

## What's included

- `api/` — API route scaffolds with placeholders
- `db/` — schema scaffolds
- `components/` — component scaffolds (if any)
- `lib/` — helper scaffolds (if any)

## How to adapt

This template uses placeholders. Replace them throughout the copied files:

| Placeholder | Replace with | Example |
|---|---|---|
| `{{ENTITY}}` | PascalCase entity name | `Invoice` |
| `{{entity}}` | camelCase entity name | `invoice` |
| `{{entities}}` | plural lowercase | `invoices` |

A quick way:
```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/{{ENTITY}}/Invoice/g' \
  -e 's/{{entity}}/invoice/g' \
  -e 's/{{entities}}/invoices/g' {} +
```

## Before / after

**Template (placeholder):**
```ts
// example placeholder code
```

**Adapted to "Invoice":**
```ts
// example adapted code
```

## Dependencies on other modules

None (or list here)

## Customization

- What pieces typically need extra editing beyond the placeholder swap
- Where the template intentionally leaves gaps for project-specific logic
