# media-utils

Pure utility functions for working with media URLs and metadata. Zero dependencies, safe to import from server, client, or edge.

## What's included

- `lib/media.ts` — that's the whole module

## API

```ts
import {
  isYouTubeUrl,         // string → boolean
  extractYouTubeId,     // string → string | null
  getYouTubeThumbnail,  // videoId → "https://img.youtube.com/vi/.../hqdefault.jpg"
  isDirectMediaUrl,     // string → boolean (ends in .mp4/.mp3/.jpg/...)
  formatDuration,       // 3725 → "1:02:05"     // 65 → "1:05"
  formatViews,          // 1234567 → "1.2M views"
  classifyMediaUrl,     // string → "youtube" | "direct" | "ytdlp" | null
} from "@/lib/media";
```

## When to reach for `classifyMediaUrl`

When you store user-supplied URLs and need to pick a player at render time:

```ts
const kind = classifyMediaUrl(item.url);
if (kind === "youtube") return <YouTubeEmbed id={extractYouTubeId(item.url)!} />;
if (kind === "direct")  return <video src={item.url} controls />;
if (kind === "ytdlp")   return <YtdlpPlayer url={item.url} />;  // resolve via /api/resolve-url
return <p>Unsupported URL</p>;
```

## Customization

- **Extension list** — add formats to `VIDEO_AUDIO_IMAGE_EXTS` if you support more.
- **Locale** — `formatDuration` is locale-neutral; `formatViews` uses English suffixes ("K"/"M"). Pass `viewSuffix: ""` to drop the " views" tail and prepend your own.

## Pairs well with

- `ytdlp-wrapper` — use `classifyMediaUrl` to decide whether to call yt-dlp.
- `video-player-toolkit` — supplies the player components/hooks that consume these classifications.
