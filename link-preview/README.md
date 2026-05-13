# link-preview

Stateless URL preview fetcher. Fetches HTML from a URL, parses Open Graph tags, and returns `{ title, domain, image }`.

## Usage

```ts
const preview = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`).then(r => r.json());
// { title: "...", domain: "example.com", image: "https://..." }
```

## Dependencies
None.

## Customization
- **Timeout**: `AbortSignal.timeout(5000)` — adjust ms as needed
- **User-Agent**: change in `route.ts`
- **Cache**: none — to cache, wrap with a SQLite table or use Next.js `unstable_cache`

## Limitations
- No cache → every call fetches from the source
- Open Graph + `<title>` only — no Twitter Cards, oEmbed, etc.
- Public endpoint (no auth) — add `verifyToken` if needed
