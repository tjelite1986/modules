# follows-system

Two flavours of "follow" in one module:

## 1. User → User follows

Classic social graph: alice follows bob.

- `follow(followerId, followedId)`
- `unfollow(followerId, followedId)`
- `listFollowers(userId, { limit, offset })`
- `listFollowing(userId, { limit, offset })`
- `isFollowing(followerId, followedId)`

Plus a `user_views` table for "X viewed your profile" counters.

## 2. User → Entity follows

Generic table for tracking external/non-user profiles. Used in Elite for following TikTok users and photo collections without creating phantom user rows for them.

- `followPhotoProfile(userId, profileSlug, sourceKind)` where `sourceKind` is e.g. `tiktok` or `instagram` or `clips`
- `listFollowedProfiles(userId)`

## Component

```tsx
import FollowList from "@/components/FollowList";

<FollowList kind="followers" userId={user.id} />
<FollowList kind="following" userId={user.id} />
```

The component handles pagination, avatars and the follow/unfollow buttons.

## Install

```bash
cp lib/follows.ts lib/photoFollows.ts <app>/src/lib/
cp components/FollowList.tsx <app>/src/components/
cp db/schema.sql <app>/db/migrations/008_views_follows.sql
sqlite3 data/app.db < <app>/db/migrations/008_views_follows.sql
```

## Requires

- `authentication` module (uses `users` table)
