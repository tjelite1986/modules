# dashboard-widgets

A free-form per-user dashboard. Cards can be dragged anywhere on the grid, resized from any of 8 directions (4 corners + 4 edges), and the layout auto-compacts vertically so dragging never leaves a giant gap. Built on `react-grid-layout` 1.5 with custom corner/edge handle styling, three breakpoints (lg 24 cols / md 12 cols / sm 1 col), and 30 px rows.

This is the **layout / storage / wrapper** — *not* a widget catalogue. Project-specific cards (clock, server stats, weather, Home Assistant, Docker, etc) live in your app and compose into the grid as children.

## What's included

| File | Purpose |
|---|---|
| `lib/dashboardLayout.ts` | `getDashboardLayout(userId)` / `setDashboardLayout(userId, layout)` — round-trips a `DashboardLayout` JSON object through the `user_dashboard_layout` row. Rejects malformed shapes and falls back to defaults. |
| `lib/dashboardSections.ts` | `DashboardLayout`, `GridItem`, `COLS`, `DEFAULT_SECTIONS`, `defaultStaticLayout`, `DYNAMIC_KEY_RE`. **`DEFAULT_SECTIONS` ships with elite-hub's section keys** — replace these with the keys your home page actually renders. |
| `lib/userWidgets.ts` | Per-user widget rows + `widget_shares` + per-viewer ordering via `user_widget_layout`. `listWidgetsFor(userId)`, `createWidget`, `updateWidget`, `deleteWidget`, `shareWith`, `setLayout`. |
| `api/dashboard/layout/route.ts` | `GET` / `PUT` the whole user dashboard layout JSON |
| `api/widgets/mine/layout/route.ts` | `PUT { order: number[] }` to reorder shared/owned widgets |
| `components/DashboardGrid.tsx` | Thin wrapper around `Responsive` from `react-grid-layout`. Adds `.dashboard-editing` on the root, vertical compaction, all 8 resize handles, drag-cancel on form elements. |
| `styles/dashboard-grid.css` | Resets `react-resizable`'s default rotated SVG handles and draws the custom cyan corner/edge handles. Only visible when the root has `.dashboard-editing`. |
| `db/schema.sql` | Combined migration: `user_widgets`, `widget_shares`, `user_widget_layout`, `user_dashboard_layout` |

## `DashboardLayout` shape

```ts
interface GridItem { i: string; x: number; y: number; w: number; h: number; }

interface DashboardLayout {
  layouts: {
    lg: GridItem[];   // 24 cols
    md: GridItem[];   // 12 cols
    sm: GridItem[];   //  1 col
  };
  hidden: string[];   // keys the user has chosen to hide
}
```

`COLS = { lg: 24, md: 12, sm: 1 }`. The `i` field is the section / widget key — strings either listed in `DEFAULT_SECTIONS` or matching `DYNAMIC_KEY_RE` (used for user-created widgets so their ids round-trip through layout JSON).

When the code base adds a new section, new users get it from `defaultStaticLayout`. Existing users have it appended to their stored layout on next read (`hidden: false`).

## Composing it

```tsx
"use client";
import { useState } from "react";
import DashboardGrid from "@/components/DashboardGrid";
import { defaultStaticLayout } from "@/lib/dashboardSections";
import type { DashboardLayout } from "@/lib/dashboardSections";

export default function HomeClient({ initial }: { initial: DashboardLayout }) {
  const [layout, setLayout] = useState(initial ?? defaultStaticLayout);
  const [editing, setEditing] = useState(false);

  const save = (next: DashboardLayout) => {
    setLayout(next);
    fetch("/api/dashboard/layout", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      },
      body: JSON.stringify(next),
    });
  };

  return (
    <>
      <button onClick={() => setEditing(e => !e)}>{editing ? "Done" : "Edit"}</button>
      <DashboardGrid layout={layout} editing={editing} onLayoutChange={save}>
        <div key="stats"><StatsCard /></div>
        <div key="recent-clips"><RecentClipsCard /></div>
        <div key="quick-links"><QuickLinksCard /></div>
      </DashboardGrid>
    </>
  );
}
```

The drag surface covers the whole card (so `<Link>`-wrapped cards stay draggable from anywhere). Form elements still receive clicks via `draggableCancel="a, button, input, textarea, select"`.

## Editing UX details

- Resize handles are **hidden in view mode** and revealed only when the root has `.dashboard-editing`. This avoids resize chrome on a "just looking" dashboard.
- Corner handles are 14 × 14 cyan squares; edge handles are thin 6 × 36 cyan sticks centered on each side. The CSS file uses `!important` to override react-resizable's default rotated SVG triangles — there's no way to disable them cleanly otherwise.
- `compactType="vertical"` packs cards upward whenever one is dropped, so dragging never leaves the page with a giant trailing gap.

## Server schema

| Table | Purpose |
|---|---|
| `user_widgets` | Configured widgets owned by users. `widget_type`, `name`, `config` (JSON), `position`. |
| `widget_shares` | `(widget_id, shared_with_user_id)` — widgets owned by A but visible to B. |
| `user_widget_layout` | `(user_id, widget_id, position)` — per-viewer ordering override for widgets visible to them. |
| `user_dashboard_layout` | `(user_id, sections)` — opaque `DashboardLayout` JSON. Legacy array-shaped values no longer parse and fall back to defaults. |

## Install

```bash
cp lib/dashboardLayout.ts lib/dashboardSections.ts lib/userWidgets.ts <app>/src/lib/
cp components/DashboardGrid.tsx <app>/src/components/
mkdir -p <app>/src/styles && cp styles/dashboard-grid.css <app>/src/styles/
mkdir -p <app>/src/app/api/dashboard/layout && cp api/dashboard/layout/route.ts <app>/src/app/api/dashboard/layout/route.ts
mkdir -p <app>/src/app/api/widgets/mine/layout && cp api/widgets/mine/layout/route.ts <app>/src/app/api/widgets/mine/layout/route.ts
cp db/schema.sql <app>/db/migrations/038_dashboard_widgets.sql
sqlite3 data/app.db < <app>/db/migrations/038_dashboard_widgets.sql

npm install react-grid-layout@^1.5 react-resizable@^3
npm install -D @types/react-grid-layout @types/react-resizable
```

Then **edit `lib/dashboardSections.ts`** to replace `DEFAULT_SECTIONS` with the section keys your home page actually renders.

## Requires

- `authentication` module — every route is gated on `verifyToken`

## Provides

- `@/lib/dashboardLayout` — server-side layout I/O
- `@/lib/dashboardSections` — types + defaults
- `@/lib/userWidgets` — per-user widget CRUD + sharing + ordering
- `@/components/DashboardGrid` — the grid wrapper

## What's NOT in here

- The **integration widgets** themselves (weather, Home Assistant, Docker, server-stats, …). Those depend on project-specific data sources and live in your app's `api/widgets/*` and `components/widgets/*`. This module just gives you the storage + drag/resize layer.
- A pre-baked `HomeClient` — your home page is too project-specific to ship; the README example above is the closest this module gets.
