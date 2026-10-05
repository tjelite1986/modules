# _modules — Claude Code Instructions

## Working rules (every session, local or cloud)

- **Language:** everything written to a file is English: code comments, UI
  strings, API error messages, log output, README, JSON descriptions, commit
  messages. Chat with the owner in Swedish. No emojis unless asked.
- **`docs/` is local-only.** It is a scratch area between the owner and Claude,
  gitignored on purpose. Never commit it and never `git add -f` it. A cloud
  session will not see it; ask the owner to paste what you need.
- **No secrets in git:** `.env`, `.env.*`, dated backups like `.env.bak-*`,
  keys and tokens. Read `git status` before every commit.
- **Target platform:** the owner self-hosts on a Raspberry Pi (linux/arm64,
  Node 20) and an x86 Linux box, as Docker images behind Traefik. Code must
  build and run on linux/arm64 with Node 20. Check that any new native
  dependency ships arm64 builds.
- **Cloud sessions cannot reach production:** no host, no live database, no
  `.env`, no container logs. Deliver work as a branch and a PR whose
  description says how to verify it live. Deploy and live verification are
  done by the owner on the host. Do not claim something works in production.
- **Data safety:** never blanket-`DELETE` or `rm` a database or data directory
  to clean up after a test; remove only what the test created.
- **Keep diffs about the change:** do not reformat code you are not otherwise
  touching. Run `prettier --check` before `prettier --write` on an older file.
- **Archive, don't delete:** don't delete branches; tag them `archive/<name>`
  first.

## Lessons learned

### Repo contract
- This repo is a one-way export: features are extracted FROM the source apps into here. Never propose consuming it via symlinks, submodules, npm workspaces or sync scripts. Copy-paste is the intended model. A generic improvement made here is backported to the source app by hand; app-specific deviations stay in the app.
- Modules are framework-generic baselines. Auth gates that depend on the consumer (e.g. the `getSession()` placeholder in `privacy-screenshot/api/image-proxy/route.ts`) are documented placeholders — keep them visible and documented rather than hard-wiring one auth module.
- Every change to a module: bump `version` in its `module.json`, update the matching entry in `registry.json`, and add a dated entry in `CHANGELOG.md`. CI fails when `registry.json` and the on-disk module folders drift, or when a module folder lacks a README.
- Drizzle modules carry `orm: "drizzle"` and ship BOTH `db/schema.ts` and `db/schema.sql`. Keep them in sync.
- `authentication` (JWT, `is_admin` column) and `auth-nextauth` (NextAuth, `role` column) both own a `users` table with incompatible schemas. Never make one module depend on both; say which one a new module needs.
- All code and names are English, including fields from Swedish-domain sources (translate kvitto/faktura/kundnummer).

### Public repo hygiene
- CI's "Secret and PII scan" fails on personal home paths, personal email addresses, the owner's domain, private LAN addresses and known secret formats. Write examples with placeholders. If a legitimate literal trips it (e.g. an RFC1918 range in an SSRF blocklist), add a narrow exclusion for that exact literal — never loosen the pattern.

### Security patterns to keep
- Media `?t=` query auth accepts ONLY media-scoped tokens (`scope: 'media'`, short-lived, inheriting the session `jti` so logout revokes them). `verifyTokenString` rejects session JWTs in URLs and media tokens in headers. Never put a full session JWT in a URL again.
- When changing an auth mechanism, grep for the mechanism (URL builders, `searchParams.get('t')` consumers), not just one literal string — a missed builder silently breaks media.
- Read routes need auth too: list, video and poster routes in `clips-library` require auth; an earlier version exposed the whole library to anonymous requests.
- `adults-pin-gate` is UI-only (sessionStorage unlock): it does not protect media URLs. Real access control must live in the API routes; `pin-content-gate` is the server-side (cookie) variant. Do not describe the former as a security boundary.
- Every yt-dlp invocation passes `--` before the URL/query, and inputs go through `assertSafeUrl` (http(s) only) / `assertSafeVideoId` (`^[A-Za-z0-9._-]{1,64}$`) in `clips-library/lib/clipsSync.ts`. Keep this at every entry point.
- Server-side fetch proxies (`privacy-screenshot` image-proxy): validate every DNS-resolved address against a numeric `net.BlockList` of private/reserved ranges, connect to the validated IP (TLS keeps `servername`), reject redirects, return opaque errors, no wildcard CORS. String-prefix host checks are not enough.
- File routes: validate each path segment as a single name (no `/`, `\`, `.`, `..`) before joining, and check containment against the specific directory, not a shared root. Next decodes `%2F` inside one segment.

### Media pitfalls
- ffmpeg/ffprobe decode tiled HEIC/HEIF as one 512x512 tile without error. Convert with libheif (`heif-convert`) first and probe dimensions from the result (`photo-gallery`).
- `Cache-Control: immutable` + regenerating a derivative at the same URL = stale forever. Version the URL (`media_version` bumped on regeneration, appended as `v=`).
- Never return `Readable.toWeb(...)` from a route: it throws an uncatchable `ERR_INVALID_STATE` when the client aborts (every seek / scroll-away). Modules that stream files ship their own `lib/nodeStream.ts` (`toWebStream(stream, req.signal)`); a new streaming module copies it rather than importing from another module.
- A file extension or claimed MIME type is not evidence; sniff leading bytes before storing a download.

### SQLite in Next.js (applies to every DB-bearing module)
- Set `busy_timeout` as the first pragma, before `journal_mode = WAL`.
- Do not open the DB at module top level in files that route handlers import; `next build` imports routes in parallel workers and races on a fresh file. Export a lazy handle.
- Read-then-write transactions need `.immediate()`; guard `ALTER TABLE ADD COLUMN` against "duplicate column name".
