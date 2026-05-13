# background-job-template

A pattern for fire-and-forget background jobs in a single-instance Next.js app.

The user kicks off something slow (download a video, transcode an image, import a playlist) over an HTTP POST. Instead of awaiting completion in the request, you spawn the work, return immediately, and update an in-memory job store as it progresses. The client polls a GET endpoint every couple seconds and renders four states: idle / working / done / error.

In the elitetube source this pattern shows up as the **download flow** (saving a yt-dlp video to local disk) and is referenced again by the **playlist import** when the playlist is too large for a synchronous request.

## What's included

| File | Per job kind? | Purpose |
|---|---|---|
| `lib/job-store.ts` | one copy per job kind | in-memory `Map<string, Job>` with get/set/delete/gc helpers |
| `api/route.ts` | one copy per job kind | GET = current state, POST = start; runs work async |
| `components/JobButton.tsx` | one copy per job kind | client polling button with 4 states |

## Placeholders

| Placeholder | Replace with | Example |
|---|---|---|
| `{{ENTITY}}` | PascalCase singular | `Download` |
| `{{entity}}` | camelCase singular | `download` |
| `{{entities}}` | plural lowercase / kebab-case | `downloads` |

Quick adapt:
```bash
cp -r templates/background-job-template my-app/_download-scaffold
cd my-app/_download-scaffold
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/{{ENTITY}}/Download/g' \
  -e 's/{{entity}}/download/g' \
  -e 's/{{entities}}/downloads/g' {} +
```

## Before / after

**Job store (template):**
```ts
export type {{ENTITY}}Job = { status: JobStatus; progress: string; ... };
export function get{{ENTITY}}Job(id: string): {{ENTITY}}Job | null { ... }
```

**Adapted to Download:**
```ts
export type DownloadJob = { status: JobStatus; progress: string; ... };
export function getDownloadJob(id: string): DownloadJob | null { ... }
```

## Wiring up the actual work

The template's `run{{ENTITY}}` function is a stub. Replace it with whatever you actually need to do — a `child_process.spawn()` for yt-dlp, an `await fetch(...)` against an external API, an FFmpeg job, etc. Update the job store with progress as it goes:

```ts
async function runDownload(id: string, req: NextRequest): Promise<void> {
  setDownloadJob(id, { status: "running", progress: "Starting yt-dlp..." });

  const child = spawn("yt-dlp", [...args]);
  child.stderr.on("data", (data) => {
    const line = data.toString().trim();
    if (line.includes("[download]") && line.includes("%")) {
      setDownloadJob(id, { status: "running", progress: line });
    }
  });

  await new Promise((resolve, reject) =>
    child.on("close", (code) =>
      code === 0 ? resolve(null) : reject(new Error(`yt-dlp exit ${code}`)),
    ),
  );

  setDownloadJob(id, {
    status: "done",
    progress: "Saved",
    result: { filename: "video.mp4" },
  });
}
```

## Limitations

- **In-memory only** — fine for a single Node.js process. Scale beyond one and the store is per-instance, polling hits a random instance and may see "idle" even mid-job. Swap `lib/<entity>-store.ts` for a Redis or DB-backed store before going horizontal.
- **No persistence across restarts** — if the process dies mid-job, the work is lost. For long jobs you actually care about, write progress to disk/DB too.
- **No queue** — POST runs immediately. If you need throttling, gate inside `run<Entity>()` with a semaphore.
- **No webhooks** — this is poll-based. If you have many simultaneous jobs and hate polling, swap the GET for SSE or websockets.

## Multiple job kinds in one app

Copy the template once per kind. You'll end up with:

```
lib/
  download-store.ts        // copy 1, sed: Download/download/downloads
  import-store.ts          // copy 2, sed: Import/import/imports
  transcode-store.ts       // copy 3, sed: Transcode/transcode/transcodes
app/api/
  downloads/[id]/route.ts
  imports/[id]/route.ts
  transcodes/[id]/route.ts
components/
  DownloadButton.tsx
  ImportButton.tsx
  TranscodeButton.tsx
```

Each kind is fully independent — separate Map, separate routes, separate polling.

## Dependencies on other modules

- `auth-nextauth` — for `authOptions` / session check on both GET and POST.

## Customization

- **Polling interval** — `pollMs` prop on the button (default 2000).
- **Auto-reload** — `reloadOnDone` (default true) reloads the page 1.5s after completion. Useful when the job materially changed the data the page is rendering.
- **Idle / working / done labels** — props on the button.
- **No-cache GET** — if you put a CDN in front, add `export const dynamic = "force-dynamic"` to `route.ts`.
