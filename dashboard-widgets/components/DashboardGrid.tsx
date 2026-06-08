"use client";

import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../styles/dashboard-grid.css";

import type { DashboardLayout, GridItem } from "../lib/dashboardSections";
import { COLS } from "../lib/dashboardSections";

const ResponsiveGridLayout = WidthProvider(Responsive);

// Maps to the same breakpoints the layout JSON uses. Keep these in sync with
// COLS in lib/dashboardSections.ts.
const BREAKPOINTS = { lg: 1280, md: 768, sm: 0 };

interface DashboardGridProps {
  layout: DashboardLayout;
  editing: boolean;
  rowHeight?: number;
  onLayoutChange?: (next: DashboardLayout) => void;
  children: React.ReactNode;
}

// Drop-in wrapper for a free-form, per-user resizable + draggable dashboard.
// You supply absolutely-positioned children (each with a `key` matching the
// `i` of a GridItem in `layout`), and toggle `editing` to enable handles.
// The wrapper:
//   - Loads the RGL + react-resizable base CSS plus dashboard-grid.css
//     overrides (custom cyan corner/edge handles, hidden in view mode)
//   - Uses compactType="vertical" so cards pack upward whenever one is moved
//   - Adds .dashboard-editing on the root when editing is true; the CSS
//     overrides reveal handles based on that class
//   - Routes layout changes through onLayoutChange with the full
//     DashboardLayout shape your storage already speaks
//
// The grid is `react-grid-layout`'s Responsive with 24 / 12 / 1 columns at
// lg / md / sm. rowHeight defaults to 30 px for fine-grained vertical sizing.
export default function DashboardGrid({
  layout,
  editing,
  rowHeight = 30,
  onLayoutChange,
  children,
}: DashboardGridProps) {
  const handleChange = (current: Layout[], all: { lg?: Layout[]; md?: Layout[]; sm?: Layout[] }) => {
    if (!onLayoutChange) return;
    onLayoutChange({
      layouts: {
        lg: toGridItems(all.lg ?? current),
        md: toGridItems(all.md ?? current),
        sm: toGridItems(all.sm ?? current),
      },
      hidden: layout.hidden,
    });
  };

  return (
    <div className={editing ? "dashboard-editing" : undefined}>
      <ResponsiveGridLayout
        className="layout"
        layouts={layout.layouts as Record<string, Layout[]>}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={rowHeight}
        margin={[12, 12]}
        compactType="vertical"
        isDraggable={editing}
        isResizable={editing}
        resizeHandles={["se", "sw", "ne", "nw", "n", "e", "s", "w"]}
        onLayoutChange={handleChange}
        draggableCancel="a, button, input, textarea, select"
      >
        {children}
      </ResponsiveGridLayout>
    </div>
  );
}

function toGridItems(items: Layout[]): GridItem[] {
  return items.map((it) => ({
    i: it.i,
    x: Math.max(0, Math.floor(it.x)),
    y: Math.max(0, Math.floor(it.y)),
    w: Math.max(1, Math.floor(it.w)),
    h: Math.max(1, Math.floor(it.h)),
  }));
}
