import { getDb } from "./db";
import { sendPushToUser, type PushPayload } from "./push";

export type NotificationType =
  | "badge.earned"
  | "follow.received"
  | "mention"
  | "feed.post"
  | "story.new";

export interface NotificationRow {
  id: number;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export function createNotification(
  userId: number,
  type: NotificationType,
  payload?: Record<string, unknown>,
): NotificationRow {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO notifications (user_id, type, payload) VALUES (?, ?, ?)")
    .run(userId, type, JSON.stringify(payload ?? {}));

  const row = {
    id: Number(result.lastInsertRowid),
    type,
    payload: payload ?? {},
    readAt: null,
    createdAt: new Date().toISOString(),
  } as NotificationRow;

  // Push to socket if user is connected
  const io = (globalThis as { _io?: { to: (r: string) => { emit: (e: string, p: unknown) => void } } })
    ._io;
  if (io) {
    io.to(`user:${userId}`).emit("notification:new", row);
  }

  return row;
}

export function getNotifications(userId: number, limit = 30): NotificationRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, type, payload, read_at AS readAt, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .all(userId, limit) as Array<{
    id: number;
    type: NotificationType;
    payload: string | null;
    readAt: string | null;
    createdAt: string;
  }>;
  return rows.map((r) => ({
    ...r,
    payload: r.payload ? JSON.parse(r.payload) : {},
  }));
}

export function getUnreadCount(userId: number): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL")
    .get(userId) as { c: number };
  return row.c;
}

export function markRead(userId: number, id: number) {
  const db = getDb();
  db.prepare(
    "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND read_at IS NULL",
  ).run(id, userId);
}

export function markAllRead(userId: number) {
  const db = getDb();
  db.prepare(
    "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL",
  ).run(userId);
}

/**
 * Notify every follower of `authorId` with the same type+payload. Used when
 * a user publishes something visible to their followers (feed post, story).
 * Returns the number of recipients reached.
 */
export function notifyFollowers(
  authorId: number,
  type: NotificationType,
  payload: Record<string, unknown>,
): number {
  const db = getDb();
  const followers = db
    .prepare(
      "SELECT follower_id AS id FROM follows WHERE following_id = ? AND follower_id != ?",
    )
    .all(authorId, authorId) as Array<{ id: number }>;
  if (followers.length === 0) return 0;

  const insert = db.prepare(
    "INSERT INTO notifications (user_id, type, payload) VALUES (?, ?, ?)",
  );
  const payloadJson = JSON.stringify(payload);
  const io = (globalThis as { _io?: { to: (r: string) => { emit: (e: string, p: unknown) => void } } })
    ._io;

  const tx = db.transaction((rows: Array<{ id: number }>) => {
    for (const f of rows) {
      const result = insert.run(f.id, type, payloadJson);
      if (io) {
        io.to(`user:${f.id}`).emit("notification:new", {
          id: Number(result.lastInsertRowid),
          type,
          payload,
          readAt: null,
          createdAt: new Date().toISOString(),
        });
      }
    }
  });
  tx(followers);

  // Fire web push (browser notification, even when no tab is open) in
  // parallel — fire-and-forget so a slow/dead push endpoint doesn't block
  // the publishing request.
  const push = pushPayloadFor(type, payload);
  if (push) {
    for (const f of followers) {
      sendPushToUser(f.id, push).catch(() => {
        /* logged inside lib */
      });
    }
  }
  return followers.length;
}

function pushPayloadFor(
  type: NotificationType,
  payload: Record<string, unknown>,
): PushPayload | null {
  if (type === "feed.post") {
    const author = (payload.authorDisplayName as string) || (payload.authorUsername as string) || "Someone";
    const preview = (payload.preview as string) || (payload.hasMedia ? "Posted a photo" : "Posted to feed");
    return {
      title: `${author} posted`,
      body: preview.slice(0, 200),
      url: payload.postId ? `/feed?post=${payload.postId}` : "/feed",
      tag: `feed-${payload.postId ?? Date.now()}`,
    };
  }
  if (type === "story.new") {
    const author = (payload.authorDisplayName as string) || (payload.authorUsername as string) || "Someone";
    const caption = (payload.caption as string) || "Added a story";
    return {
      title: `${author} added a story`,
      body: caption.slice(0, 200),
      url: payload.authorUsername
        ? `/feed?story=${encodeURIComponent(String(payload.authorUsername))}`
        : "/feed",
      tag: `story-${payload.storyId ?? Date.now()}`,
    };
  }
  return null;
}
