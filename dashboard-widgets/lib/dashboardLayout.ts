import { getDb } from "./db";
import {
  COLS,
  DEFAULT_SECTIONS,
  DYNAMIC_KEY_RE,
  defaultStaticLayout,
  type DashboardLayout,
  type GridItem,
} from "./dashboardSections";

export { DEFAULT_SECTIONS, defaultStaticLayout };
export type { DashboardLayout, GridItem };

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function parseGridItem(raw: unknown): GridItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.i)) return null;
  if (!isValidKey(r.i)) return null;
  if (!isFiniteNumber(r.x) || !isFiniteNumber(r.y)) return null;
  if (!isFiniteNumber(r.w) || !isFiniteNumber(r.h)) return null;
  return {
    i: r.i,
    x: Math.max(0, Math.floor(r.x)),
    y: Math.max(0, Math.floor(r.y)),
    w: Math.max(1, Math.floor(r.w)),
    h: Math.max(1, Math.floor(r.h)),
  };
}

function isValidKey(key: string): boolean {
  if (DEFAULT_SECTIONS.some((d) => d.key === key)) return true;
  return DYNAMIC_KEY_RE.test(key);
}

function parseLayout(json: string): DashboardLayout | null {
  try {
    const v = JSON.parse(json);
    if (!v || typeof v !== "object") return null;
    const layouts = (v as any).layouts;
    if (!layouts || typeof layouts !== "object") return null;
    const lg = Array.isArray(layouts.lg) ? layouts.lg.map(parseGridItem).filter(Boolean) as GridItem[] : [];
    const md = Array.isArray(layouts.md) ? layouts.md.map(parseGridItem).filter(Boolean) as GridItem[] : [];
    const sm = Array.isArray(layouts.sm) ? layouts.sm.map(parseGridItem).filter(Boolean) as GridItem[] : [];
    const hidden = Array.isArray((v as any).hidden)
      ? ((v as any).hidden as unknown[]).filter(isString).filter(isValidKey)
      : [];
    return { layouts: { lg, md, sm }, hidden };
  } catch {
    return null;
  }
}

function clampToCols(items: GridItem[], cols: number): GridItem[] {
  return items.map((it) => {
    const w = Math.min(Math.max(1, it.w), cols);
    const x = Math.min(Math.max(0, it.x), cols - w);
    return { ...it, w, x };
  });
}

function clampLayout(layout: DashboardLayout): DashboardLayout {
  return {
    layouts: {
      lg: clampToCols(layout.layouts.lg, COLS.lg),
      md: clampToCols(layout.layouts.md, COLS.md),
      sm: clampToCols(layout.layouts.sm, COLS.sm),
    },
    hidden: layout.hidden,
  };
}

export function getLayout(userId: number): DashboardLayout | null {
  const db = getDb();
  const row = db
    .prepare("SELECT sections FROM user_dashboard_layout WHERE user_id = ?")
    .get(userId) as { sections: string } | undefined;
  if (!row) return null;
  return parseLayout(row.sections);
}

export function setLayout(userId: number, layout: DashboardLayout): DashboardLayout {
  const clean = clampLayout(layout);
  const db = getDb();
  db.prepare(
    `INSERT INTO user_dashboard_layout (user_id, sections, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       sections = excluded.sections,
       updated_at = CURRENT_TIMESTAMP`,
  ).run(userId, JSON.stringify(clean));
  return clean;
}

export function resetLayout(userId: number): null {
  const db = getDb();
  db.prepare("DELETE FROM user_dashboard_layout WHERE user_id = ?").run(userId);
  return null;
}
