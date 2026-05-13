# section-tabs

A pill-style sub-navigation for grouped pages. Useful when two or three routes belong to the same conceptual section and should share a header.

## Usage

Declare a tab set:

```ts
// src/lib/sectionTabs.ts
import type { SectionTab } from "@/components/SectionTabs";

export const videoTabs: SectionTab[] = [
  { href: "/videos", label: "All" },
  { href: "/videos/clips", label: "Clips" },
  { href: "/videos/tiktok", label: "TikTok" },
];
```

Mount it at the top of every page in the group:

```tsx
import SectionTabs from "@/components/SectionTabs";
import { videoTabs } from "@/lib/sectionTabs";

export default function ClipsPage() {
  return (
    <>
      <SectionTabs tabs={videoTabs} />
      {/* page content */}
    </>
  );
}
```

The active tab is detected from `usePathname()`.

## Install

```bash
cp components/SectionTabs.tsx <app>/src/components/
cp lib/sectionTabs.ts <app>/src/lib/
```
