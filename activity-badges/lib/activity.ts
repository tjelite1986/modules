import { getDb } from "./db";
import { evaluateBadges } from "./badges";

export type ActivityType =
  | "auth.register"
  | "profile.update"
  | "profile.avatar"
  | "profile.banner"
  | "presence.status"
  | "badge.earned"
  | "follow.create";

export interface ActivityRow {
  id: number;
  userId: number;
  type: ActivityType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export function recordActivity(
  userId: number,
  type: ActivityType,
  payload?: Record<string, unknown>,
): void {
  const db = getDb();
  db.prepare("INSERT INTO activity (user_id, type, payload) VALUES (?, ?, ?)").run(
    userId,
    type,
    JSON.stringify(payload ?? {}),
  );

  // Best-effort badge evaluation in the background.
  Promise.resolve()
    .then(() => evaluateBadges(userId))
    .catch((err) => console.error("[badges] evaluate failed", err));
}

export function getActivityForUser(userId: number, limit = 30): ActivityRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, user_id AS userId, type, payload, created_at AS createdAt FROM activity WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .all(userId, limit) as Array<{
    id: number;
    userId: number;
    type: ActivityType;
    payload: string | null;
    createdAt: string;
  }>;
  return rows.map((r) => ({
    ...r,
    payload: r.payload ? JSON.parse(r.payload) : {},
  }));
}
