# notification-bell

An in-app notification center modelled after Twitter/GitHub.

## Features

- Bell icon with unread count badge
- Dropdown with infinite-scroll list
- Each notification has a type (`mention`, `dm`, `follow`, `comment`, `story_view`, ...) and a `link`
- Click to mark-as-read and navigate to the linked content
- "Mark all as read" button
- Live updates over Socket.IO — the bell flashes when a new notification arrives
- Server-side fanout via `notifyUser(userId, payload)` — same call site can target many users via `notifyUsers([...])`

## How it composes

- Standalone: writes to `notifications` table, emits over Socket.IO when `global._io` is set
- Optional pairing with `web-push-vapid`: in `notifyUser`, also call `sendPush` to reach offline users on mobile
- Optional pairing with `activity-badges`: notify the user when they earn a badge

## Install

```bash
cp lib/notifications.ts <app>/src/lib/
cp components/NotificationsBell.tsx <app>/src/components/
cp -r api/* <app>/src/app/api/notifications/
cp db/schema.sql <app>/db/migrations/007_notifications.sql
sqlite3 data/app.db < <app>/db/migrations/007_notifications.sql
```

Mount the bell:

```tsx
import NotificationsBell from "@/components/NotificationsBell";
<NotificationsBell />
```

## Provides

`@/lib/notifications`:
- `notifyUser(userId, payload)` — write + emit
- `listForUser(userId, { limit, before })` — paginated list
- `markRead(notifId, userId)` and `markAllRead(userId)`
- `unreadCount(userId)`
