# authentication

JWT-based login/register with invite codes, admin accounts, session tracking, and DB-backed brute-force lockout. Backend in Next.js App Router, storage in SQLite via `better-sqlite3`.

## What's included

- `lib/auth.ts` — `verifyToken`, `verifyTokenLoose`, `verifyAdmin`, `signToken`, `signMediaToken`, `extractJti`
- `lib/mediaToken.ts` — client-side cache/refresh for the media token used in `?t=` asset URLs
- `lib/loginRateLimit.ts` — `checkAllowed`, `recordFailure`, `recordSuccess` (per-identifier brute-force lockout)
- `api/login/route.ts` — POST `/api/auth/login` (identifier can be username or email; rate-limited)
- `api/register/route.ts` — POST `/api/auth/register` (requires invite code)
- `api/media-token/route.ts` — GET `/api/auth/media-token` (issues the scoped media token)
- `lib/authCookie.ts` + `api/cookie/route.ts` + `middleware.ts` — httpOnly-cookie mirror of the session JWT and an edge middleware that gates server-rendered pages
- `pages/login/page.tsx`, `pages/register/page.tsx` — ready-made UI pages (Tailwind, dark theme — feel free to restyle)
- `db/schema.sql` — `users`, `invite_codes`, `sessions`, `login_attempts`

## Brute-force lockout

The login route is gated by `lib/loginRateLimit.ts`, which keeps a per-identifier counter in the `login_attempts` table. The ladder is:

| Failed attempts | Lock duration |
|---|---|
| 1–4 | none (response is still `401`, so an attacker cannot tell rate-limit from wrong-password until the 5th try) |
| 5 | 5 min |
| 10 | 30 min |
| 20 | 4 h |

On lockout the route responds `429` with a `Retry-After` header. A successful login clears the counter. Rows are scrubbed after 24 h of inactivity.

The identifier is lowercased before hashing into the table, so `Alice` and `alice` share a bucket — that matches how the user lookup works (email is lowercased; usernames are case-sensitive but a brute-forcer doesn't know that).

## Media tokens — query-string auth for asset routes

Browsers can't set custom headers on plain `<img src>`, `<video src>`, `<embed src>`, `<iframe src>`, or `<a download href>`, so asset routes (`bookshelf` covers/files, `photo-gallery` thumbnails, etc.) authenticate via a `?t=<token>` query parameter instead.

Since 0.3.0 that parameter only accepts a **media token**: a short-lived (24 h) JWT signed with `scope: 'media'`. The full session JWT is rejected in query strings, and media tokens are rejected by `verifyToken`/`verifyAdmin`, so a token leaked through access logs, browser history, `Referer` headers, or proxy caches cannot be replayed against the regular API and expires within a day. The media token inherits the parent session's `jti`, so logging out revokes it immediately.

Flow:

1. Client calls `GET /api/auth/media-token` with the session JWT in the `Authorization` header
2. The route returns `{ token }` — a 24 h `scope: 'media'` JWT
3. Client embeds it in asset URLs: `<img src="/api/.../thumb/key?t=<mediaToken>">`
4. Asset routes call `verifyTokenLoose(req)`, which accepts header auth (session) or `?t=` (media scope only)

`lib/mediaToken.ts` handles the client lifecycle: `mediaToken()` is a synchronous accessor for URL builders (localStorage-cached, background refresh), `ensureMediaToken()` awaits a fresh token (call it after login and on app load), `clearMediaToken()` belongs in your logout path.

Hardening tips for hostile environments: set `Referrer-Policy: no-referrer` on asset responses and strip the `t` query param in access-log scrubbers.

## Page gating — why the cookie exists

Bearer tokens in `localStorage` are invisible to the server, so any **server component** renders its data into HTML/RSC for unauthenticated visitors too — client-side redirects in a dashboard shell only hide it after delivery. Since 0.4.0 the login route mirrors the JWT as an `httpOnly` cookie (`lib/authCookie.ts`), and `middleware.ts` verifies it with `jose` (edge-safe) and redirects anonymous page requests to `/login`.

- API routes are excluded by the matcher — they keep header/media-token auth
- `PUBLIC_PAGES` lists routes that must stay anonymous (`/login`, `/register`, share pages); adjust per project, along with the asset exclusions in the matcher
- Middleware checks signature + expiry only; DB-backed session revocation still happens in the API layer
- Sessions created before the cookie existed self-heal: the login page POSTs the stored bearer token to `/api/auth/cookie` and bounces back
- Logout clears the cookie

## Installation

### 1. Install npm deps
```bash
npm install jsonwebtoken@^9.0.2 bcryptjs@^2.4.3 better-sqlite3@^9.6.0
npm install -D @types/jsonwebtoken @types/bcryptjs
```

### 2. Set env variable
In `.env.local`:
```
JWT_SECRET=your-long-random-string-here
```
Generate one easily: `openssl rand -hex 32`

### 3. Create `src/lib/db.ts` if it doesn't already exist
The module requires the project to export `getDb()` from `@/lib/db`:
```ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

declare global { var _db: Database.Database | undefined; }

export function getDb(): Database.Database {
  if (global._db) return global._db;
  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, 'app.db'));
  global._db = db;
  return db;
}
```

### 4. Copy files according to `module.json` → `files[]`

### 5. Run db schema
```bash
sqlite3 data/app.db < db/migrations/001_auth.sql
```

### 6. Create the first admin and invite code
```bash
sqlite3 data/app.db
> INSERT INTO users (username, password_hash, is_admin) VALUES ('admin', '<bcrypt-hash>', 1);
> INSERT INTO invite_codes (code, created_by) VALUES ('FIRSTUSE', 1);
```

## Use in other API routes

```ts
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // user.id, user.username
}
```

For admin-only:
```ts
import { verifyAdmin } from '@/lib/auth';
const admin = verifyAdmin(req);
if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
```

## Client side

The UI pages save the token in `localStorage` as `auth_token`. Send it with requests:
```ts
fetch('/api/whatever', {
  headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
});
```

## Module dependencies
None.

## Customization
- **Token name in localStorage**: change `auth_token` in `pages/*/page.tsx` if you want
- **Token lifetime**: change `expiresIn: '30d'` in `lib/auth.ts`
- **Password policy**: edit the validation in `api/register/route.ts`
- **DB table names**: search/replace in all SQL strings if you want a prefix

## Limitations
- No email verification or password reset
- Invite codes are created manually in the DB (or via the admin-panel module)
- Sessions are not auto-cleaned — implement a cleanup job if needed
