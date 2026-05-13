/**
 * Client-safe helpers for converting between the on-disk/internal slug form
 * (`<profile>/<basename>` or `<basename>`) and the URL form used in API routes.
 *
 * The Next.js `[slug]` segment can't match a `/`, so we encode it as `~` for
 * transport. Bijective because `~` is rejected by the slug charset.
 */

export function encodeSlugForUrl(slug: string): string {
  return slug.replace(/\//g, "~");
}

export function decodeSlugFromUrl(s: string): string {
  return s.replace(/~/g, "/");
}
