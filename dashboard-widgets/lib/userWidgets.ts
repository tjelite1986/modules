import { getDb } from "./db";

export type WidgetType = "clock" | "server" | "weather" | "docker" | "homeAssistant" | "uptime";

export const VALID_WIDGET_TYPES: WidgetType[] = [
  "clock",
  "server",
  "weather",
  "docker",
  "homeAssistant",
  "uptime",
];

export function isValidWidgetType(s: string): s is WidgetType {
  return (VALID_WIDGET_TYPES as readonly string[]).includes(s);
}

export interface UserWidget {
  id: number;
  userId: number;
  type: WidgetType;
  name: string | null;
  config: Record<string, unknown>;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: number;
  user_id: number;
  widget_type: string;
  name: string | null;
  config: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function rowToWidget(r: Row): UserWidget {
  let cfg: Record<string, unknown> = {};
  try {
    cfg = JSON.parse(r.config || "{}");
  } catch {}
  return {
    id: r.id,
    userId: r.user_id,
    type: r.widget_type as WidgetType,
    name: r.name,
    config: cfg,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listMyWidgets(userId: number): UserWidget[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT w.*, l.position AS view_position
       FROM user_widgets w
       LEFT JOIN user_widget_layout l
         ON l.widget_id = w.id AND l.user_id = ?
       WHERE w.user_id = ?
       ORDER BY COALESCE(l.position, w.position) ASC, w.id ASC`,
    )
    .all(userId, userId) as Array<Row & { view_position: number | null }>;
  return rows.map(rowToWidget);
}

export function listSharedWithMe(userId: number): Array<UserWidget & { ownerUsername: string }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT w.*, u.username AS owner_username, l.position AS view_position
       FROM widget_shares s
       JOIN user_widgets w ON w.id = s.widget_id
       JOIN users u ON u.id = w.user_id
       LEFT JOIN user_widget_layout l
         ON l.widget_id = w.id AND l.user_id = s.shared_with_user_id
       WHERE s.shared_with_user_id = ?
       ORDER BY COALESCE(l.position, w.position) ASC, w.id ASC`,
    )
    .all(userId) as Array<Row & { owner_username: string; view_position: number | null }>;
  return rows.map((r) => ({ ...rowToWidget(r), ownerUsername: r.owner_username }));
}

export function setLayout(userId: number, orderedWidgetIds: number[]): void {
  const db = getDb();
  // Confirm the user is allowed to position each widget (owns it or it's
  // shared with them) before writing anything, so a malformed payload can't
  // smuggle in unrelated widget ids.
  const visible = new Set<number>([
    ...listMyWidgets(userId).map((w) => w.id),
    ...listSharedWithMe(userId).map((w) => w.id),
  ]);
  const filtered = orderedWidgetIds.filter((id) => visible.has(id));
  const upsert = db.prepare(
    `INSERT INTO user_widget_layout (user_id, widget_id, position, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, widget_id) DO UPDATE SET
       position = excluded.position,
       updated_at = CURRENT_TIMESTAMP`,
  );
  const tx = db.transaction((ids: number[]) => {
    ids.forEach((id, idx) => upsert.run(userId, id, idx));
  });
  tx(filtered);
}

export function getWidget(id: number): UserWidget | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM user_widgets WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToWidget(row) : null;
}

export function canRead(userId: number, widgetId: number): boolean {
  const w = getWidget(widgetId);
  if (!w) return false;
  if (w.userId === userId) return true;
  const db = getDb();
  const row = db
    .prepare(
      "SELECT 1 AS one FROM widget_shares WHERE widget_id = ? AND shared_with_user_id = ?",
    )
    .get(widgetId, userId);
  return !!row;
}

export function createWidget(opts: {
  userId: number;
  type: WidgetType;
  name?: string | null;
  config?: Record<string, unknown>;
}): UserWidget {
  const db = getDb();
  const cfg = JSON.stringify(opts.config ?? {});
  const lastPosRow = db
    .prepare("SELECT COALESCE(MAX(position), -1) AS p FROM user_widgets WHERE user_id = ?")
    .get(opts.userId) as { p: number };
  const result = db
    .prepare(
      "INSERT INTO user_widgets (user_id, widget_type, name, config, position) VALUES (?, ?, ?, ?, ?)",
    )
    .run(opts.userId, opts.type, opts.name ?? null, cfg, lastPosRow.p + 1);
  return getWidget(result.lastInsertRowid as number)!;
}

export function updateWidget(
  id: number,
  patch: { name?: string | null; config?: Record<string, unknown>; position?: number },
): UserWidget | null {
  const db = getDb();
  const w = getWidget(id);
  if (!w) return null;
  const name = patch.name === undefined ? w.name : patch.name;
  const config = patch.config === undefined ? w.config : patch.config;
  const position = patch.position === undefined ? w.position : patch.position;
  db.prepare(
    "UPDATE user_widgets SET name = ?, config = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(name, JSON.stringify(config), position, id);
  return getWidget(id);
}

export function deleteWidget(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM user_widgets WHERE id = ?").run(id);
}

export function listShares(widgetId: number): Array<{ userId: number; username: string; sharedAt: string }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.shared_with_user_id AS user_id, u.username, s.shared_at
       FROM widget_shares s
       JOIN users u ON u.id = s.shared_with_user_id
       WHERE s.widget_id = ?
       ORDER BY u.username`,
    )
    .all(widgetId) as Array<{ user_id: number; username: string; shared_at: string }>;
  return rows.map((r) => ({ userId: r.user_id, username: r.username, sharedAt: r.shared_at }));
}

export function shareWidget(widgetId: number, sharedWithUserId: number): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO widget_shares (widget_id, shared_with_user_id) VALUES (?, ?)",
  ).run(widgetId, sharedWithUserId);
}

export function unshareWidget(widgetId: number, sharedWithUserId: number): void {
  const db = getDb();
  db.prepare(
    "DELETE FROM widget_shares WHERE widget_id = ? AND shared_with_user_id = ?",
  ).run(widgetId, sharedWithUserId);
}
