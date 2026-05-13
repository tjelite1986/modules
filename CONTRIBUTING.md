# Contributing

Thanks for considering a contribution. This repo is a personal library that I (deliberately) keep open so others can copy from it and propose improvements. Below is what makes a change land cleanly.

## What kind of contributions fit here

| Welcome | Less welcome |
|---|---|
| New self-contained Next.js modules with clear scope | "Mega-modules" that bundle several unrelated features |
| Bug fixes to existing modules | Cosmetic refactors with no behaviour change |
| Updated dependency versions | Switching the stack (e.g. swapping React for Solid) |
| Better READMEs / clearer install steps | Removing existing patterns to "modernise" |
| Drizzle ports of raw-SQL modules (keep both) | Drizzle ports that replace the raw SQL |
| New templates for repeating patterns | Highly project-specific features |

If you're not sure whether your idea fits, open an issue first and ask.

## Stack assumptions

Every module here is written for the same stack — read this before you start:

- **Next.js 14, App Router** — API routes are `route.ts`, server/client components use `"use client"` directives, no Pages-Router conventions
- **TypeScript 5+** — no plain JavaScript outside of socket handler files (`*-socket.js`) which intentionally stay JS so Node can run them via `tsx` without compile
- **React 18+** — server components by default, `"use client"` only where needed
- **Tailwind CSS 3+** — utility classes inline, no CSS modules
- **better-sqlite3** for raw-SQL modules, **Drizzle** for ORM modules. Drizzle modules ship both `db/schema.ts` and `db/schema.sql` as a fallback
- **Hand-rolled JWT** (`authentication`) or **NextAuth** (`auth-nextauth`) — never both in one module
- **Socket.IO 4+** for any realtime functionality
- **Strings in code are English**, even if the source app is Swedish. Filenames, error messages, comments, log lines, JSON keys — all English

If your module needs a dep outside this stack (a different ORM, a different UI lib, a different runtime), open an issue first.

## Adding a new module

### 1. Check there isn't already one

```bash
jq -r '.modules[].name' registry.json | sort
```

If something close exists, prefer extending it over duplicating.

### 2. Copy the template

```bash
cp -r _template my-new-module
```

You get a skeleton: `module.json`, `README.md`, empty `api/`, `components/`, `db/`, `hooks/`, `lib/`.

### 3. Fill in `module.json`

The contract for every module. Fields you MUST set:

- `name` — kebab-case, matches the folder name
- `description` — one sentence, ends without a period
- `category` — `auth | chat | data | ui | media | notification | infra | other`
- `framework` — at minimum `{ next: ">=14", react: ">=18" }`
- `dependencies.npm` — array of `"package@^semver"` strings
- `dependencies.modules` — array of other module names this one needs
- `files[]` — every file ships with `{ from: "path/in/module", to: "path/in/consumer/project" }`
- `envVars[]` — even if empty, declare the field
- `postInstall[]` — numbered steps the consumer must run by hand

Optional but encouraged:

- `providesContract` — what the module exports (libraries, hooks, components, events)
- `requiresContract` — what the consumer must already have (e.g. `users` table)

### 4. Write the README

Each module's `README.md` should answer:

1. **What it does** in 2–4 sentences
2. **Features** as a bullet list of user-visible behaviours
3. **How it works** (1 paragraph for non-trivial modules)
4. **Install** as a copy-paste shell block
5. **Requires** — which other modules and which external tools
6. **Provides** — the exported API surface

Look at `live-chat/README.md` or `photo-gallery/README.md` for solid examples.

### 5. Update `registry.json`

Add an entry under `modules[]` with `name`, `path`, `description`, `category`, `tags`, `version`, `status` (`stable | experimental | deprecated`).

### 6. Update the count

If you add a module:

- Bump the count in `README.md` ("**N modules + 2 templates**")
- Bump the count in the GitHub repo description (manual via `gh repo edit`)
- Bump the `Modules-N-violet` badge in `README.md`

### 7. Open a PR

- One module per PR
- Title: `Add <module-name> module`
- Body: link to the source project you extracted from (if any), and call out anything unusual (uses a feature flag, requires a specific Node version, etc.)

## Updating an existing module

- Keep changes backwards-compatible when possible. Bumping `version` in `module.json` is encouraged for any non-trivial change.
- For breaking changes: bump `version` to the next major, mention "BREAKING:" in the PR title, and document the migration in the module's README.
- Touch `registry.json` only if the description / tags / status changed.

## Local sanity checks

There's no test suite — modules are extracted from working apps, so the "test" is "did it work in production". Before you open a PR:

1. **`module.json` parses as JSON**: `jq . my-module/module.json`
2. **The `files[]` paths exist on disk**
3. **`dependencies.npm` strings match the format `name@semver-range`**
4. **The module's README has working copy-paste install commands** — `cp -r my-module/api/... <app>/...` etc.
5. **No `/home/...`, no internal hostnames, no secrets** in any file you add. (`grep -rEn "/home/|@gmail|sk-[a-zA-Z0-9]" my-module/`)
6. **All strings in code are in English** (filenames, error messages, comments, console.log/error)

## Reporting bugs

Open an issue with:

- Which module
- What you ran
- What you expected
- What happened
- Your Next.js / Node version

Pasting the relevant `module.json` snippet helps.

## License

By contributing, you agree your work is released under this repo's [MIT license](./LICENSE).
