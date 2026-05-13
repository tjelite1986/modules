// Service worker for clip/shorts18 video caching + Web Push.
//
// Browsers fetch <video src> with HTTP range requests, which can't be
// cached directly. We sidestep that by issuing a single full-file fetch
// the first time we see a given video URL, storing it in the Cache API,
// and serving every subsequent range request by slicing the cached
// response. Re-watching a clip while scrolling back becomes instant and
// no longer touches the server.
//
// In addition we handle 'push' events to display in-app notifications
// even when no Elite tab is open, and 'notificationclick' to focus the
// most relevant existing tab (or open a new one) on the URL we sent.

const CACHE = "elite-videos-v3";
const IMAGE_CACHE = "elite-images-v1";
const VIDEO_RE = /\/api\/(clips|shorts18)\/[^/]+\/video(?:\?|$)/;
// Anything that serves an immutable image URL (posters, thumbs, previews,
// shared-item images) — these all carry a `?v=<mtime>` or token in the URL
// so the URL itself is the cache key and we never have to invalidate.
const IMAGE_RE =
  /\/api\/(?:clips|shorts18|photos)\/[^/]+\/poster(?:\?|$)|\/api\/gallery\/(?:thumb|preview|shared-item)\//;
const RANGE_RE = /bytes=(\d+)-(\d*)/;
const MAX_ENTRIES = 60;
const MAX_IMAGE_ENTRIES = 600;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Elite", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Elite";
  const body = data.body || "";
  const url = data.url || "/";
  const tag = data.tag || `elite-${Date.now()}`;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: data.icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(targetUrl); } catch { /* ignore */ }
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const keep = new Set([CACHE, IMAGE_CACHE]);
      await Promise.all(
        keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname + url.search;
  if (VIDEO_RE.test(path)) {
    event.respondWith(handleVideo(req));
    return;
  }
  if (IMAGE_RE.test(url.pathname)) {
    event.respondWith(handleImage(req));
    return;
  }
});

// Cache-first for thumbnails/posters/previews. They all include a
// `?v=<mtime>` or share-token in the URL, so the URL changes whenever the
// file changes — no need for any validation, just serve from cache forever.
async function handleImage(req) {
  const cache = await caches.open(IMAGE_CACHE);
  const url = new URL(req.url);
  const cacheKey = new Request(url.pathname + url.search);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) {
      cache.put(cacheKey, res.clone()).catch(() => {});
      evictOldestImage(cache).catch(() => {});
    }
    return res;
  } catch {
    return new Response("", { status: 504 });
  }
}

async function evictOldestImage(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_IMAGE_ENTRIES) return;
  const remove = keys.length - MAX_IMAGE_ENTRIES;
  for (let i = 0; i < remove; i++) await cache.delete(keys[i]);
}

async function handleVideo(req) {
  const cache = await caches.open(CACHE);
  const url = new URL(req.url);
  const cacheKey = new Request(url.pathname + url.search);
  const range = req.headers.get("range");

  let cached = await cache.match(cacheKey);
  if (!cached) {
    try {
      const fullRes = await fetch(url.pathname + url.search, {
        method: "GET",
        cache: "no-store",
      });
      if (fullRes.status === 200) {
        await cache.put(cacheKey, fullRes.clone());
        evictOldest(cache).catch(() => {});
        cached = fullRes;
      } else {
        return fetch(req);
      }
    } catch {
      return fetch(req);
    }
  }

  if (!range) return cached.clone();

  const buffer = await cached.clone().arrayBuffer();
  const total = buffer.byteLength;
  const match = range.match(RANGE_RE);
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : total - 1;
  if (Number.isNaN(start) || start >= total || end >= total || start > end) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }
  const slice = buffer.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      "Content-Type": cached.headers.get("content-type") || "video/mp4",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
    },
  });
}

async function evictOldest(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  const remove = keys.length - MAX_ENTRIES;
  for (let i = 0; i < remove; i++) {
    await cache.delete(keys[i]);
  }
}
