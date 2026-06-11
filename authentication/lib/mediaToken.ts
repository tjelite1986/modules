"use client";

// Client-side cache for the short-lived media token used in ?t= query
// strings on <img>/<video> URLs. The full session token must never be
// placed in URLs — only this media-scoped token (see lib/auth.ts).

const STORAGE_KEY = "media_token";
// Refresh when less than 2 of the 24 hours remain.
const REFRESH_MARGIN_MS = 2 * 60 * 60 * 1000;

let inflight: Promise<string | null> | null = null;

function tokenExpiryMs(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function isFresh(token: string): boolean {
  return tokenExpiryMs(token) - Date.now() > REFRESH_MARGIN_MS;
}

// Synchronous accessor for URL builders. Kicks off a background refresh
// when the cached token is missing or close to expiry.
export function mediaToken(): string {
  if (typeof window === "undefined") return "";
  const cached = localStorage.getItem(STORAGE_KEY) ?? "";
  if (!cached || !isFresh(cached)) void ensureMediaToken();
  return cached;
}

// Fetches a fresh media token when needed. Await this once after login /
// on app load so URL builders always have a token available.
export async function ensureMediaToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached && isFresh(cached)) return cached;
  if (inflight) return inflight;

  const session = localStorage.getItem("auth_token");
  if (!session) return null;

  inflight = fetch("/api/auth/media-token", {
    headers: { Authorization: `Bearer ${session}` },
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.token !== "string") return null;
      localStorage.setItem(STORAGE_KEY, data.token);
      return data.token as string;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function clearMediaToken() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}
