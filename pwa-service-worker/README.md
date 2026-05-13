# pwa-service-worker

The minimum a Next.js app needs to be installable and to receive push notifications on mobile.

## What's in sw.js

- `install` — claims clients immediately, no precache (works fine for a server-rendered app)
- `push` — parses JSON payload `{title, body, url, icon, tag}` and shows a notification
- `notificationclick` — focuses an existing tab on `url` or opens a new one

The worker is intentionally cache-less; if you want offline support, add a workbox build or hand-rolled cache strategy.

## Web Share Target

The bundled `ShareTargetModal.tsx` reads URL params (`?title=...&text=...&url=...`) that the OS share sheet sends to your PWA. Mount it under a `/share` route and add to your manifest:

```json
{
  "share_target": {
    "action": "/share",
    "method": "GET",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
}
```

Now your hub appears as a share target everywhere the OS supports PWAs (Android: everywhere, iOS: not yet).

## Install

```bash
cp public/sw.js <app>/public/sw.js
cp components/ServiceWorkerRegister.tsx <app>/src/components/
cp components/ShareTargetModal.tsx <app>/src/components/
```

Add to `app/layout.tsx`:

```tsx
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
```

Create `public/manifest.json` with at minimum `name`, `start_url`, and an icon. Lighthouse PWA audit will tell you what's missing.
