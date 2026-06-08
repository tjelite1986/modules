# video-share

A drop-in "share to…" modal that turns any media item — a clip, a photo, a generated video — into a feed post, an ephemeral story, or a DM. One UI, one `ShareSource` interface, three destinations. Used in elite-hub on the `Newspaper`-button across `/videos/clips`, `/videos/shorts18` and `/photos`.

## What's included

- `components/ShareTargetModal.tsx` — the modal component + `ShareSource` / `ShareSourceKind` exports
- `components/Avatar.tsx` — minimal avatar used in the recipient list (optional; skip if you already have one)

## How it works

The caller passes a `ShareSource` and the modal renders three tabs: **Feed**, **Story**, **DM**. Selecting a tab + (for DM) a recipient, then **Send**, POSTs to the corresponding endpoint:

```ts
import ShareTargetModal, { type ShareSource } from "@/components/ShareTargetModal";

// Anywhere you have a video/photo to share:
const [src, setSrc] = useState<ShareSource | null>(null);

<button onClick={() => setSrc({
  kind: "external",
  mediaUrl: `/api/clips/${slug}/video`,
  mediaType: "video/mp4",
  previewUrl: `/api/clips/${slug}/poster`,
})}>
  Share
</button>

<ShareTargetModal
  open={!!src}
  source={src}
  onClose={() => setSrc(null)}
  onShared={() => setSrc(null)}
/>
```

For **gallery items** you only supply an id — the modal calls the server to mint a share-token so the recipient can view the media even if they're not the owner:

```ts
setSrc({ kind: "gallery", galleryItemId: photo.id, previewUrl: photo.thumbUrl });
```

For **batches** (e.g. "share these 5 photos") use the `sources` array form:

```ts
setSrc({ kind: "external", sources: selectedItems.map(item => ({ kind: "gallery", galleryItemId: item.id })) });
```

The modal collapses singletons and renders a stacked preview for batches.

## `ShareSource` shape

```ts
type ShareSourceKind = "gallery" | "photos" | "external";

interface ShareSource {
  kind: ShareSourceKind;
  galleryItemId?: number;     // when kind === "gallery"
  mediaUrl?: string;          // when kind === "external"
  mediaType?: string;
  mediaName?: string;
  sourceRef?: string;         // preserved on the resulting feed/story row
  previewUrl?: string;        // thumbnail rendered in the preview header
  sources?: ShareSource[];    // batch form
}
```

## Endpoints the modal expects

| Endpoint | From module | Used when |
|---|---|---|
| `POST /api/feed` | `social-feed` | "Feed" tab → creates a feed post |
| `POST /api/stories` | `stories-with-ttl` | "Story" tab → creates an ephemeral story |
| `POST /api/dms` | `direct-messaging` | "DM" tab + recipient → sends a DM with the media attached |
| `GET /api/users` | `user-profiles` | recipient picker on the DM tab |
| `GET /api/channels` | `channel-management` | optional — channel picker for posting to a channel feed |

All of these should accept `{ content?, mediaUrl?, mediaType?, sourceRef? }` in the body. The modal degrades gracefully if `/api/channels` returns 404.

## Install

```bash
cp components/ShareTargetModal.tsx <app>/src/components/
# Optional — if your app doesn't already have an Avatar component:
cp components/Avatar.tsx <app>/src/components/
```

Then make sure the dependency modules are installed (`social-feed`, `stories-with-ttl`, `direct-messaging`, `user-profiles`) so the endpoints exist.

## Requires

- `authentication` module — the modal reads `auth_token` from `localStorage` and sends it as `Authorization: Bearer`
- `social-feed`, `stories-with-ttl`, `direct-messaging`, `user-profiles` — for the endpoints above
- An `Avatar` component at `@/components/Avatar` (or use the bundled one)

## Provides

- `@/components/ShareTargetModal` — default export + `ShareSource`, `ShareSourceKind` named exports

## Why a separate module

Each piece (feed, stories, DMs) is useful on its own and lives in its own module. `video-share` is the small UI-glue layer that unifies the *user-facing* share gesture so consumers don't write a custom modal in every feature. Without it, every feature that wants share-to-anywhere has to render three buttons and re-implement the recipient picker.
