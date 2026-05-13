# Templates

Reusable code **patterns** for Next.js projects — different from the modules at the repo root.

## Modules vs Templates

| | Modules (repo root) | Templates (`./templates/`) |
|---|---|---|
| What it is | A complete, working feature | A pattern/scaffold you adapt |
| How you use it | Copy files per `module.json`, install deps, done | Copy files, then rename + edit for your specific entity |
| Coupling | Self-contained | Generic — fields/names are placeholders |
| Example | `customer-register` | `transaction-crud-template` (used to build invoices, receipts, orders) |

## Layout

Each template is a folder with the same shape as a module:

```
template-name/
├── module.json          # metadata + file mapping (uses {{ENTITY}} placeholders)
├── README.md            # the pattern explained, with concrete examples
├── api/                 # API route scaffolds
├── components/          # component scaffolds
├── db/                  # schema scaffolds
└── lib/                 # helper scaffolds
```

## Conventions

- File contents use `{{ENTITY}}`, `{{entity}}`, `{{Entity}}` placeholders for the entity name
  in PascalCase, camelCase, kebab-case respectively.
- The README always includes at least one **before/after** showing the placeholder template
  vs a real concrete adaptation.
- Templates may depend on modules (e.g. an auth module) — declared in `module.json` `dependencies.modules`.

## Index

See `registry.json` for the full list.
