# video-player-toolkit

Hooks and components for building a YouTube-style HTML5 video player. Each piece is independently usable.

## What's included

- `hooks/usePlayerKeyboard.ts` — keyboard shortcuts (space/k, j/l, arrows, m, f, 0–9) + transient OSD text
- `hooks/useVideoResume.ts` — saves playback position to localStorage and resumes on next load
- `components/PlayerOsd.tsx` — overlay for the OSD text from `usePlayerKeyboard`
- `components/SpeedSelector.tsx` — playback-speed pill row, persisted in localStorage
- `components/ContinueWatching.tsx` — *optional* — carousel that reads the resume store and fetches item metadata

## Minimal usage

```tsx
"use client";
import { useVideoResume } from "@/hooks/useVideoResume";
import { usePlayerKeyboard } from "@/hooks/usePlayerKeyboard";
import PlayerOsd from "@/components/PlayerOsd";
import SpeedSelector from "@/components/SpeedSelector";

export function Player({ id, src }: { id: number; src: string }) {
  const { videoRef, resumedFrom } = useVideoResume(id);
  const { osd } = usePlayerKeyboard(videoRef);

  return (
    <div>
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        {resumedFrom && (
          <span className="absolute top-3 left-3 z-10 bg-black/75 text-white text-xs px-2.5 py-1 rounded-full">
            Resumed from {resumedFrom}
          </span>
        )}
        <video ref={videoRef} src={src} controls autoPlay className="w-full h-full" />
        <PlayerOsd text={osd} />
      </div>
      <SpeedSelector videoRef={videoRef} />
    </div>
  );
}
```

## Keyboard shortcuts (`usePlayerKeyboard`)

| Key | Action |
|---|---|
| Space / K | play / pause |
| ← / J | seek −10s |
| → / L | seek +10s |
| ↑ / ↓ | volume ±5% |
| M | mute / unmute |
| F | fullscreen toggle (video only) |
| 0–9 | jump to 0–90% of duration |

Shortcuts are skipped while the user is typing in `<input>`, `<textarea>`, `<select>`, or any contenteditable element — so they're safe to enable globally.

## Resume positions (`useVideoResume`)

- Saves position every 5 seconds while playing.
- Restores only if > 10s in AND not within 95% of the end.
- Clears position when the video ends naturally.
- The `key` argument (number or string) is appended to the localStorage prefix. Use a stable id per media item.

The default prefix is `video_resume_`. If you ship multiple apps on the same origin, set `NEXT_PUBLIC_VIDEO_RESUME_PREFIX` to namespace them.

## Continue Watching carousel

Wire it to your own catalog endpoint:

```tsx
import ContinueWatching from "@/components/ContinueWatching";

<ContinueWatching
  fetchItems={async (ids) => {
    const res = await fetch(`/api/media?ids=${ids.join(",")}`);
    const data = await res.json();
    return data.items.map((m: any) => ({
      id: m.id,
      title: m.title,
      duration: m.duration,
      thumbnailUrl: m.thumbnail_url,
    }));
  }}
  watchHref={(item) => `/watch/${item.id}`}
  filterKey={(key) => /^\d+$/.test(key)}  // exclude non-numeric keys
/>
```

The carousel reads all keys from the resume store, fetches metadata for the corresponding items, and skips entries that are 95%+ done.

## Customization

- **OSD styling** — edit `PlayerOsd.tsx` to match your design system (colours, font, position).
- **Speed list** — `SPEEDS` in `SpeedSelector.tsx` is `[0.5, 0.75, 1, 1.25, 1.5, 2]`. Edit if you want 0.25 or 3×.
- **Tailwind classes** — every component uses generic Tailwind (`bg-zinc-800`, `text-white`); adapt to your design tokens.
- **No state library** — everything is local state + localStorage. Lift to your store if you want SSR-aware resumption.
