# auth-nextauth

NextAuth-based credentials authentication with role-based access control (user/admin), JWT sessions, and bcrypt password hashing. Alternative to the hand-rolled JWT auth in the `authentication` module.

## When to pick this over `authentication`

| Need | Pick |
|------|------|
| Built-in session management, social providers later, middleware-based route protection | **auth-nextauth** |
| Lightweight, manual control, custom JWT payloads, multi-device session tracking with revocation | **authentication** |

You cannot have both installed at the same time — they own the same `users` table with different schemas (`role` column vs `is_admin`).

## What's included

- `lib/auth.ts` — `authOptions` for NextAuth (CredentialsProvider, JWT strategy, session/jwt callbacks)
- `lib/auth-db.ts` — `getAuthDb()`, `findUser()`, schema init, optional admin seed
- `lib/admin.ts` — `requireAdmin()` guard for API routes
- `api/[...nextauth]/route.ts` — NextAuth route handler
- `types/next-auth.d.ts` — TS module augmentation for `Session.user.role` etc.
- `components/Providers.tsx` — `<SessionProvider>` wrapper for the root layout
- `pages/login/page.tsx` — ready-made login form
- `middleware.ts` — optional `withAuth` middleware that gates everything except `/login`
- `db/schema.sql` — `users` table

## Installation

### 1. Install npm deps
```bash
npm install next-auth@^4.24.7 bcryptjs@^2.4.3 better-sqlite3@^11.3.0
npm install -D @types/bcryptjs @types/better-sqlite3
```

### 2. Set env vars
```bash
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
# Optional — auto-seeds an admin on first DB access
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
```

### 3. Wrap the root layout

```tsx
// src/app/layout.tsx
import { Providers } from "@/components/Providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 4. (Optional) Drop in middleware to protect all routes

The included `middleware.ts` redirects unauthenticated users to `/login` for every page except `/login` itself, `/api/auth/*`, and Next.js static assets.

### 5. Schema is auto-initialized — no manual migration

The first call to `getAuthDb()` runs the schema and seeds the admin if env vars are set.

## Usage

### Server component / API route — read session
```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const session = await getServerSession(authOptions);
if (!session) return new Response("Unauthorized", { status: 401 });
// session.user.id, session.user.name, session.user.role
```

### API route — admin-only guard
```ts
import { requireAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;
  // ...rest of handler
}
```

### Client component — sign out
```tsx
"use client";
import { signOut, useSession } from "next-auth/react";

export function UserMenu() {
  const { data: session } = useSession();
  if (!session) return null;
  return (
    <div>
      Hi {session.user?.name} ({session.user?.role})
      <button onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
```

## Adding more users

Two options:
1. Drop in via SQL: `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')` (hash with bcrypt)
2. Build your own `/admin/users` page that calls `bcrypt.hashSync(pw, 10)` server-side and inserts

Self-registration is not included — add a `/api/auth/register` route if you want it.

## Customization

- **Session lifetime**: `maxAge: 60 * 60 * 24 * 30` (30 days) in `lib/auth.ts`
- **Roles**: only `user` / `admin` by default. Add more by adjusting the role check in `requireAdmin` and the schema CHECK constraint
- **DB filename**: `app.db` in `getAuthDb` — change if you want different naming
- **Login page styling**: `pages/login/page.tsx` uses Tailwind with zinc/indigo — restyle freely

## Limitations

- Credentials provider only — no OAuth out of the box. Adding Google/GitHub is just a few lines in `authOptions.providers`
- No email verification, password reset, or multi-factor auth
- Single SQLite file — for multi-server deploys, swap `auth-db.ts` for a Postgres adapter
