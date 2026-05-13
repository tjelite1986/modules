# dashboard-shell

A reusable app-shell layout for Next.js apps. Three components, drop-in usage:

```tsx
import DashboardShell from "@/components/DashboardShell";

export default function MyPage() {
  return (
    <DashboardShell>
      <h1>My content</h1>
    </DashboardShell>
  );
}
```

## What you get

- **Sidebar** (`<Sidebar />`)
  - Collapsible (icon-only at <240px width)
  - Feature-gated nav items via the `feature` prop — wire it to your settings module
  - Active-path highlighting (handles `matchPaths` for routes that share a section)
  - Mobile: turns into a slide-out drawer triggered by the hamburger in TopBar
- **TopBar** (`<TopBar />`)
  - Sticky search input
  - Notification bell slot
  - Avatar dropdown
- **DashboardShell** (`<DashboardShell>{children}</DashboardShell>`)
  - Wires them together
  - Handles auth redirect to `/login` if no token

## Customising

Edit the `navItems` array at the top of `Sidebar.tsx`:

```tsx
const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home, color: "text-sky-400" },
  { href: "/feed", label: "Social feed", icon: Newspaper, color: "text-pink-400", feature: "feed" },
  // ...
];
```

The `feature` field is optional. If you wire it to a settings store, items can be hidden per-user.

## Install

```bash
cp components/*.tsx <app>/src/components/
```

## Requires

- `authentication` module (uses `useAuthUser` hook)
- Optionally `notification-bell` module (TopBar drops in NotificationsBell)
