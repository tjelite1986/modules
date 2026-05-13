# module-name

Short description of what this module does and why you'd want it.

## What's included

- `components/` — React components
- `api/` — API routes (Next.js App Router)
- `db/` — SQL schema / migrations
- `lib/` — Helper functions
- `hooks/` — React hooks

## Installation (manual)

1. **Install dependencies**
   ```bash
   npm install <packages-from-module.json>
   ```

2. **Copy files** according to the mapping in `module.json` → `files[]`

3. **Set env variables** in `.env.local`:
   ```
   EXAMPLE_VAR=value
   ```

4. **Run db migration** (if one exists):
   ```bash
   sqlite3 data/app.db < db/migrations/001_example.sql
   ```

5. **Use the module** — example:
   ```tsx
   import { Example } from "@/components/example/Example"

   export default function Page() {
     return <Example />
   }
   ```

## Dependencies on other modules

None (or list here if the module requires e.g. the `auth` module)

## Customization

- Describe which parts often need to be tweaked per project
- E.g. styling, db table names, auth integration

## Limitations

- What the module does NOT do
- Known issues
