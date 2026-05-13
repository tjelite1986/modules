# stories-with-ttl

Ephemeral story posts that disappear after a configurable TTL (default 24h).

## How it works

- Each story row has a `created_at` timestamp
- `listActiveStories()` filters out rows older than `STORY_TTL_HOURS`
- A separate archive script (see `transcoder-pipeline` module) moves the underlying media file to `_expired/` so it stops showing up in scans
- The DB row stays around (for view counters and analytics) but is hidden from the public feed

## Features

- `StoryBar` — horizontal pill row at the top of the feed showing each user with active stories
- `StoryViewer` — fullscreen tap-to-advance modal
- Stories can be standalone uploads or references to existing gallery items (via `gallery_item_shares` tokens)
- View tracking — each viewer is recorded once per story
- Reply-to-story DMs (optional)

## Install

```bash
cp lib/stories.ts <app>/src/lib/
cp components/StoryBar.tsx components/StoryViewer.tsx <app>/src/components/
cp -r api/* <app>/src/app/api/stories/
cp db/schema.sql <app>/db/migrations/030_share_and_stories.sql
sqlite3 data/app.db < <app>/db/migrations/030_share_and_stories.sql
```

Mount the bar:

```tsx
import StoryBar from "@/components/StoryBar";
<StoryBar currentUserId={me.id} />
```

## Provides

`@/lib/stories` exports `listActiveStories`, `createStory`, `getStory`, `markStoryViewed`, `pruneExpired`.
