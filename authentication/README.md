# authentication

JWT-based login/register with invite codes, admin accounts, session tracking, and DB-backed brute-force lockout. Backend in Next.js App Router, storage in SQLite via `better-sqlite3`.

## What's included

- `lib/auth.ts` — `verifyToken`, `verifyAdmin`, `signToken`, `extractJti`
- `lib/loginRateLimit.ts` — `checkAllowed`, `recordFailure`, `recordSuccess` (per-identifier brute-force lockout)
- `api/login/route.ts` — POST `/api/auth/login` (identifier can be username or email; rate-limited)
- `api/register/route.ts` — POST `/api/auth/register` (requires invite code)
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

## `verifyTokenLoose` — known tradeoff

`verifyTokenLoose(req)` accepts the JWT either in the `Authorization` header OR in a `?t=<jwt>` query parameter. It exists because browsers can't set custom headers on plain `<img src>`, `<video src>`, `<embed src>`, `<iframe src>`, or `<a download href>`, and asset routes (`bookshelf` covers/files, photo-gallery thumbnails, etc.) need *some* way to authenticate those requests.

**The tradeoff:** putting a bearer JWT in a URL means it can leak via:

- HTTP access logs (web server, reverse proxy, CDN)
- Browser history and tab-restore state
- The `Referer` header on any outbound request the rendered asset triggers (especially an EPUB or PDF that contains external links)
- Intermediate proxy caches

In this module's threat model — small self-hosted apps behind a single Traefik reverse proxy, single user-base, HTTPS-only — this is an accepted risk. The token is the same long-lived (30 day) JWT the rest of the API uses, so a leaked URL is roughly equivalent to a stolen session.

**If you need a tighter bound**, replace `verifyTokenLoose` with a short-lived asset-scoped capability token:

1. Add an endpoint `POST /api/<resource>/:id/asset-token` that takes the bearer JWT in the `Authorization` header
2. Have it return `jwt.sign({ sub: user.id, res: 'book:<slug>/file', exp: now + 300 }, ASSET_SECRET)`
3. In the asset route, verify the scoped token and check `payload.res === expectedResource` and `payload.exp`
4. Set `Referrer-Policy: no-referrer` on asset responses to suppress the `Referer` leak from rendered content
5. Configure your access-log scrubbers to strip the `t` query param

This is a real improvement but a non-trivial refactor — each asset route gains a one-RTT prelude and the client has to manage the asset-token lifecycle. Consider it for production deployments that face untrusted networks or share an environment with logging infrastructure you don't control.

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
