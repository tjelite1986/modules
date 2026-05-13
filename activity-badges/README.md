# activity-badges

A lightweight gamification module: count user actions and award badges when thresholds are met.

## How it works

Two layers:

1. **Activity counters** — `user_activity (user_id, kind, count, updated_at)`. Counters increment with `recordActivity(userId, 'kind')`.
2. **Badges** — `user_badges (user_id, badge_id, earned_at)`. A static rules list in `badges.ts` maps badge IDs to evaluator functions over the counters.

## Example badge rules

```ts
export const BADGE_RULES: BadgeRule[] = [
  { id: "first_message", name: "First word", evaluator: (a) => a.message_sent >= 1 },
  { id: "chatty", name: "Chatty", evaluator: (a) => a.message_sent >= 100 },
  { id: "shutterbug", name: "Shutterbug", evaluator: (a) => a.photo_uploaded >= 50 },
];
```

After every `recordActivity()` you (or a cron) calls `evaluateBadges(userId)` which inserts any new rows in `user_badges`.

## Pair with `notification-bell`

Wrap the loop to send a notification each time a badge is granted:

```ts
const newBadges = evaluateBadges(userId);
for (const b of newBadges) {
  notifyUser(userId, { type: "badge", badgeId: b.id, link: "/profile" });
}
```

## Install

```bash
cp lib/badges.ts lib/activity.ts <app>/src/lib/
cp -r api/* <app>/src/app/api/badges/
cp db/schema.sql <app>/db/migrations/006_activity_badges.sql
sqlite3 data/app.db < <app>/db/migrations/006_activity_badges.sql
```
