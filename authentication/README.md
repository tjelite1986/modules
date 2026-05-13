# authentication

JWT-based login/register with invite codes, admin accounts, and session tracking. Backend in Next.js App Router, storage in SQLite via `better-sqlite3`.

## What's included

- `lib/auth.ts` — `verifyToken`, `verifyAdmin`, `signToken`, `extractJti`
- `api/login/route.ts` — POST `/api/auth/login` (identifier can be username or email)
- `api/register/route.ts` — POST `/api/auth/register` (requires invite code)
- `pages/login/page.tsx`, `pages/register/page.tsx` — ready-made UI pages (Tailwind, dark theme — feel free to restyle)
- `db/schema.sql` — `users`, `invite_codes`, `sessions`

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
