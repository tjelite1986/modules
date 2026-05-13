# pin-content-gate

A bcrypt-protected PIN that restricts access to a section of your app on top of normal auth. Originally built for an "adult content" age gate; works for any "extra confirmation needed" use case (paid tier, dev-only routes, etc.).

## How it works

1. An admin sets a PIN via `POST /api/admin/gate-pin` (stored as bcrypt hash in `settings.gate_pin_hash`).
2. A user lands on a gated page; the server checks for the unlock cookie. If missing → render `<PinGate />`.
3. User enters PIN → `POST /api/gate/verify-pin` → if match, sets a session cookie.
4. The route reloads server-side, the cookie is now present, content renders.

## What's included

- `lib/pin-gate.ts` — `PIN_GATE_CONFIG` (cookie name, hash key, min length, bcrypt rounds)
- `db/schema.sql` — `settings` table (skip if you already have one)
- `api/verify-pin.ts` — `POST /api/gate/verify-pin`
- `api/admin-pin.ts` — `GET / POST /api/admin/gate-pin` (admin)
- `components/PinGate.tsx` — numeric keypad with customisable copy

## Server-side gate check

In any layout or page that should be protected:

```tsx
import { cookies } from "next/headers";
import { PIN_GATE_CONFIG } from "@/lib/pin-gate";
import PinGate from "@/components/PinGate";

export default function ProtectedPage() {
  const cookieStore = cookies();
  if (!cookieStore.get(PIN_GATE_CONFIG.cookieName)) {
    return <PinGate />;
  }
  return <YourContent />;
}
```

## Customising the keypad

```tsx
<PinGate
  icon="🔞"
  title="Age verification"
  description="This content is marked 18+. Enter the PIN to continue."
  minLength={6}
  maxLength={10}
  verifyEndpoint="/api/gate/verify-pin"
/>
```

## Multiple gates

Need both an "adult content" gate and a separate "dev tools" gate? Copy `lib/pin-gate.ts` into two configs, route them to different `cookieName`/`pinHashKey` values, and copy the API routes to two paths. Each gate is fully independent.

## Security notes

- PIN is hashed with bcrypt (12 rounds by default).
- Cookie is `httpOnly` + `sameSite: lax`, session-only (no `maxAge`) — closes-browser logout.
- Admin routes require `session.user.role === "admin"` (from `auth-nextauth`).
- The cookie is *not* tied to a specific user id — it's a per-browser-session unlock. If user A unlocks, user B on the same browser session is also unlocked. That matches the original "extra confirmation" intent; if you need per-user gates, store the unlock state in the user session instead.

## Dependencies on other modules

- `auth-nextauth` — for `authOptions` and the admin role check.

## Customization

- **Multiple gates** — copy the lib + API routes per gate, give each a unique `cookieName` and `pinHashKey`.
- **Persistent unlock** — add `maxAge` to the cookie in `verify-pin.ts`.
- **PIN length** — `minLength` / `maxLength` props on `<PinGate>` and `PIN_GATE_CONFIG.minPinLength` for the admin route.
- **Style** — Tailwind classes use generic `zinc`/`red` palette; adapt per your tokens.
