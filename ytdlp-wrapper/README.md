# ytdlp-wrapper

Server-side wrapper around the [yt-dlp](https://github.com/yt-dlp/yt-dlp) CLI for Node.js apps. Five core operations: fetch metadata, search YouTube, resolve playable URLs, dump flat playlists, and helpers for spawning yt-dlp directly when you need progress streaming.

## What's included

- `lib/ytdlp.ts` — the wrapper (cookie-aware, structured errors)
- `api/info.ts` — `POST /api/ytdlp/info` (admin) — metadata for one URL
- `api/youtube-search.ts` — `GET /api/youtube/search?q=...` — YouTube search
- `api/resolve-url.ts` — `GET /api/resolve-url?url=...` — resolve to stream URL

The 3 API routes are convenience wrappers; copy only what you actually use. The library is the main artefact.

## Install

```bash
# Host/container
sudo apt-get install -y yt-dlp        # or: pip install yt-dlp
node --version                         # required by yt-dlp's --js-runtimes node

# .env.local
YTDLP_PATH=/usr/bin/yt-dlp             # optional, defaults to /usr/bin/yt-dlp
YTDLP_COOKIES_PATH=/app/data/cookies.txt  # optional, for age-gated/private content
```

## Library API

```ts
import {
  fetchYtdlpMeta,        // metadata for one URL
  searchYoutube,         // YouTube full-text search
  resolveYtdlpUrl,       // → playable HTTPS stream URL
  dumpFlatPlaylist,      // → array of flat playlist entries
  ytdlpSpawnArgs,        // common args (--cookies etc.) for child_process.spawn
  ytdlpBinaryPath,       // path to the yt-dlp binary
  YtdlpCookieError,      // thrown on auth/cookie errors
} from "@/lib/ytdlp";

// Metadata
const meta = await fetchYtdlpMeta("https://www.youtube.com/watch?v=...");
// → { title, duration, thumbnail, description, tags }

// YouTube search
const hits = await searchYoutube("lo-fi beats", 10);
// → [{ id, title, duration, thumbnail, channel, view_count, url }, ...]

// Resolve to stream URL (any yt-dlp-supported site, not just YouTube)
const streamUrl = await resolveYtdlpUrl("https://...");

// Bulk: dump a playlist's items without downloading
const entries = await dumpFlatPlaylist("https://...playlist...");
// → [{ id, title, url, webpage_url, thumbnail, duration }, ...]
```

## Cookie handling

yt-dlp gets blocked by YouTube and other sites unless it has session cookies. Set `YTDLP_COOKIES_PATH` to a Netscape-format `cookies.txt` (export from your browser).

When yt-dlp returns a cookie/auth error, the wrapper throws `YtdlpCookieError`. The bundled API routes translate this into HTTP 403 with `error_code: "COOKIES_EXPIRED"` so the client can show a "renew cookies" UI.

```ts
try {
  await fetchYtdlpMeta(url);
} catch (err) {
  if (err instanceof YtdlpCookieError) {
    // tell the user to refresh cookies.txt
  }
}
```

## Spawning yt-dlp directly (for progress streaming)

`fetchYtdlpMeta` and friends use `execFile` (one-shot, no progress). To stream progress (e.g. for downloads), use the helpers and spawn yt-dlp yourself:

```ts
import { spawn } from "child_process";
import { ytdlpSpawnArgs, ytdlpBinaryPath } from "@/lib/ytdlp";

const child = spawn(ytdlpBinaryPath(), [
  ...ytdlpSpawnArgs(),
  "--no-playlist",
  "--merge-output-format", "mp4",
  "-o", "/path/to/output.%(ext)s",
  "--", url,
]);

child.stderr.on("data", (data: Buffer) => {
  // parse [download] xx.x% lines for progress
});
```

See the `playlist-import-job` module and the `background-job-template` for the full pattern.

## Dependencies on other modules

- `auth-nextauth` — used by the API routes (`getServerSession`, `authOptions`). Drop the auth checks if you want public endpoints (don't — yt-dlp is expensive).

## Customization

- **Format string** — `FORMAT` is hard-coded to prefer direct HTTPS MP4 over HLS for browser-friendliness. Edit if you need HLS, audio-only, etc.
- **Timeouts** — 20s for metadata, 30s for search, 15s for URL resolve. Adjust per host load.
- **Cookie error patterns** — `COOKIE_ERROR_PATTERNS` is a heuristic; extend if you hit new error strings.
