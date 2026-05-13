# adults-pin-gate

A simple, per-user 4-digit PIN to gate 18+ content. Different from `pin-content-gate` (which is a server-side single PIN protecting whole routes) — this one is per-user, set the first time it's needed, and stored as a bcrypt hash.

## Behaviour

1. User opens a page wrapped in `<AdultsPinGate>`
2. If their `users.adults_pin_hash` is `NULL`, the gate shows a "set PIN" prompt
3. If it's set, the gate shows a "enter PIN" prompt
4. Successful entry unlocks the gate for the current tab session (sessionStorage)
5. Closing the tab re-locks

## Usage

```tsx
import AdultsPinGate from "@/components/AdultsPinGate";

export default function Shorts18Page() {
  return (
    <AdultsPinGate>
      {/* gated content */}
    </AdultsPinGate>
  );
}
```

## Install

```bash
cp components/AdultsPinGate.tsx <app>/src/components/
cp db/schema.sql <app>/db/migrations/032_users_adults_pin.sql
sqlite3 data/app.db < <app>/db/migrations/032_users_adults_pin.sql
```

## Why not `pin-content-gate` instead?

`pin-content-gate` is a server-side gate using one shared PIN — good for public-but-private pages. This module is per-user, browser-side, and intended for legally-mandated age confirmation rather than secrecy. Combine them if you want both.
