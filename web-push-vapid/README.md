# web-push-vapid

Server-driven push notifications using the standard Web Push protocol and VAPID auth. Works on every major browser including iOS Safari 16.4+.

## What it does

- `GET /api/push/vapid-key` — exposes the public key for the browser to use
- `POST /api/push/subscribe` — stores a `PushSubscription` JSON for the current user
- `DELETE /api/push/subscribe` — removes a subscription
- `lib/push.ts` — server-side `sendPush(userId, payload)` helper that loops every active subscription and prunes 410-Gone entries

## Install

```bash
cp lib/push.ts lib/pushClient.ts <app>/src/lib/
cp -r api/* <app>/src/app/api/push/
cp db/schema.sql <app>/db/migrations/033_push_subscriptions.sql
sqlite3 data/app.db < <app>/db/migrations/033_push_subscriptions.sql

npm install web-push @types/web-push
npx web-push generate-vapid-keys
```

Add the two VAPID keys and `VAPID_CONTACT` (a mailto: URL) to `.env`.

## Sending a push

```ts
import { sendPush } from "@/lib/push";

await sendPush(userId, {
  title: "New message",
  body: "alice sent you a DM",
  url: "/chats/alice",
  icon: "/icon-192.png",
});
```

`sendPush` walks every subscription for the user, removes any that return 404/410, and ignores 429s.

## Requires

- `authentication` module
- A service worker that listens for the `push` event (install `pwa-service-worker` for a reference implementation)
