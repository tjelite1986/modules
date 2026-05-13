import webpush from "web-push";
import { getDb } from "./db";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_CONTACT = process.env.VAPID_CONTACT || "mailto:admin@example.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function publicVapidKey(): string {
  return VAPID_PUBLIC_KEY;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function saveSubscription(
  userId: number,
  sub: PushSubscriptionInput,
  userAgent: string | null,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, ua)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       ua = excluded.ua,
       last_seen_at = CURRENT_TIMESTAMP`,
  ).run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent);
}

export function deleteSubscription(userId: number, endpoint: string): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?")
    .run(userId, endpoint);
  return result.changes > 0;
}

export function userHasSubscriptions(userId: number): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT 1 AS hit FROM push_subscriptions WHERE user_id = ? LIMIT 1")
    .get(userId) as { hit: number } | undefined;
  return !!row;
}

export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(
  userId: number,
  payload: PushPayload,
): Promise<{ delivered: number; expired: number }> {
  if (!ensureConfigured()) return { delivered: 0, expired: 0 };
  const db = getDb();
  const subs = db
    .prepare(
      "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    )
    .all(userId) as Array<{ id: number; endpoint: string; p256dh: string; auth: string }>;
  if (subs.length === 0) return { delivered: 0, expired: 0 };

  const body = JSON.stringify(payload);
  let delivered = 0;
  let expired = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
        );
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 mean the browser dropped the subscription — clean it up
        // so we don't keep retrying dead endpoints.
        if (status === 404 || status === 410) {
          db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(s.id);
          expired++;
        }
      }
    }),
  );
  return { delivered, expired };
}
