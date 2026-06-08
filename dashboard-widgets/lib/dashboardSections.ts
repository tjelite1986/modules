// Server-safe AND client-safe: pure data + types only. Kept separate from
// dashboardLayout.ts so client components can import the section catalog
// without dragging better-sqlite3 into the browser bundle.

export interface SectionDef {
  key: string;
  label: string;
  defaultWidth: number; // out of 12 (lg)
  defaultHeight: number; // in row units (rowHeight ~ 50px)
}

// Canonical order of static home page sections. Adding a section here makes
// it appear (auto-placed) on every existing user's layout on the next load.
// Widths are in 24-col units (lg/md grid); heights in rowHeight units (~30px).
export const DEFAULT_SECTIONS: SectionDef[] = [
  { key: "hero", label: "Greeting", defaultWidth: 24, defaultHeight: 5 },

  { key: "stat:online", label: "Online count", defaultWidth: 6, defaultHeight: 3 },
  { key: "stat:users", label: "Members count", defaultWidth: 6, defaultHeight: 3 },
  { key: "stat:apps", label: "Apps count", defaultWidth: 6, defaultHeight: 3 },
  { key: "stat:games", label: "Games count", defaultWidth: 6, defaultHeight: 3 },

  { key: "online", label: "Online users", defaultWidth: 24, defaultHeight: 4 },

  { key: "act:posts", label: "Today: posts", defaultWidth: 6, defaultHeight: 3 },
  { key: "act:photos", label: "Today: photos", defaultWidth: 6, defaultHeight: 3 },
  { key: "act:imports", label: "Today: imports", defaultWidth: 6, defaultHeight: 3 },

  { key: "approw:saved", label: "Saved apps row", defaultWidth: 24, defaultHeight: 5 },
  { key: "approw:recent", label: "Recently added row", defaultWidth: 24, defaultHeight: 5 },

  { key: "top:apps", label: "Top downloads", defaultWidth: 8, defaultHeight: 8 },
  { key: "top:clips", label: "Top clips", defaultWidth: 8, defaultHeight: 8 },

  { key: "feed", label: "Feed", defaultWidth: 14, defaultHeight: 11 },
  { key: "store", label: "Recent store", defaultWidth: 10, defaultHeight: 11 },

  { key: "quicklinks", label: "Quick links", defaultWidth: 24, defaultHeight: 4 },
];

export const DEFAULT_SECTION_BY_KEY: Record<string, SectionDef> =
  Object.fromEntries(DEFAULT_SECTIONS.map((s) => [s.key, s]));

export const DYNAMIC_KEY_RE = /^(widget|bookmark):/;

export type Breakpoint = "lg" | "md" | "sm";

export const BREAKPOINTS = { lg: 1024, md: 500, sm: 0 } as const;
// Fine-grained columns let users place and resize cards with small steps.
// md (≥500px → tablet portrait) keeps a 12-col grid so widgets and stat
// tiles can still sit side-by-side; sm stacks vertically.
export const COLS = { lg: 24, md: 12, sm: 1 } as const;

export interface GridItem {
  i: string; // section key
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardLayout {
  layouts: { lg: GridItem[]; md: GridItem[]; sm: GridItem[] };
  hidden: string[]; // keys hidden by the user
}

export function defaultDimsForKey(key: string): { w: number; h: number } {
  const def = DEFAULT_SECTION_BY_KEY[key];
  if (def) return { w: def.defaultWidth, h: def.defaultHeight };
  if (key.startsWith("widget:")) return { w: 6, h: 5 };
  if (key.startsWith("bookmark:")) return { w: 12, h: 5 };
  return { w: 24, h: 4 };
}

// Auto-flow placement on a grid with `cols` columns. Cards never overlap;
// each new card is placed at the first row where it fits, scanning top-down
// then left-to-right.
function autoPlace(keys: string[], cols: number): GridItem[] {
  const items: GridItem[] = [];
  const occupied: Record<number, Set<number>> = {};
  const isFree = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++) {
      const row = occupied[y + dy];
      if (!row) continue;
      for (let dx = 0; dx < w; dx++) {
        if (row.has(x + dx)) return false;
      }
    }
    return true;
  };
  const occupy = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++) {
      const ry = y + dy;
      if (!occupied[ry]) occupied[ry] = new Set();
      for (let dx = 0; dx < w; dx++) occupied[ry].add(x + dx);
    }
  };
  for (const key of keys) {
    const { w: rawW, h } = defaultDimsForKey(key);
    const w = Math.min(rawW, cols);
    let placed = false;
    for (let y = 0; !placed; y++) {
      for (let x = 0; x + w <= cols && !placed; x++) {
        if (isFree(x, y, w, h)) {
          items.push({ i: key, x, y, w, h });
          occupy(x, y, w, h);
          placed = true;
        }
      }
    }
  }
  return items;
}

export function defaultLayoutFor(keys: string[]): DashboardLayout {
  return {
    layouts: {
      lg: autoPlace(keys, COLS.lg),
      md: autoPlace(keys, COLS.md),
      sm: keys.map((key, idx) => {
        const { h } = defaultDimsForKey(key);
        // single column: all cards full width, stacked top to bottom
        return { i: key, x: 0, y: idx * 10_000, w: 1, h };
      }).map((item, idx, all) => {
        // Re-flow y values so each card sits right after the previous one.
        let cumY = 0;
        for (let i = 0; i < idx; i++) cumY += all[i].h;
        return { ...item, y: cumY };
      }),
    },
    hidden: [],
  };
}

export function defaultStaticLayout(): DashboardLayout {
  return defaultLayoutFor(DEFAULT_SECTIONS.map((s) => s.key));
}
