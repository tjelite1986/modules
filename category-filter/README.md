# category-filter

Stateless filter pills component. Renders an "All" button plus one pill per category, with active state styling and horizontal scroll on mobile.

## Usage

```tsx
"use client";
import { useState } from "react";
import { CategoryFilter } from "@/components/CategoryFilter";

const categories = ["Productivity", "Games", "Tools"];

function MyListing({ entries }) {
  const [active, setActive] = useState<string | null>(null);
  const filtered = active ? entries.filter(e => e.meta.category === active) : entries;

  return (
    <>
      <CategoryFilter categories={categories} active={active} onChange={setActive} />
      <div className="grid">{filtered.map(...)}</div>
    </>
  );
}
```

## Dependencies
- `clsx` (could be replaced with template literals if you don't want it)

## Customization

- **Color**: `bg-indigo-600` accent — replace with your brand
- **Layout**: `flex gap-2 overflow-x-auto pb-3` — horizontal scroll on mobile, normal flex on `sm:`
- **All-label**: hard-coded `"All"` — pass as a prop if you want it configurable

## Limitations

- Stateless — caller owns the filter state
- No multi-select — single active category at a time
