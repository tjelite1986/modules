# privacy-screenshot

A floating "shield" button in the corner of your app that lets you safely capture demo screenshots without leaking private data.

## Why this exists

Taking screenshots of a real, populated app for marketing or bug reports is a privacy minefield: profile photos, addresses, message contents, geotagged locations. This module gives you one button to:

1. CSS-blur every image, video and PII element
2. Tap or right-click any other element to manually blur it
3. Take a PNG screenshot (viewport or full page) — the screenshot bakes the blur in so it survives any post-processing

## Features

- **Privacy mode** — body classes `privacy-blur-media` + `privacy-blur-pii` apply CSS `filter: blur(...)` to everything tagged
- **Tap-to-blur picker** — click any element to add `data-manual-blur="1"`; right-click toggles
- **One-click screenshot** — html-to-image `toPng()` with extensive workarounds:
  - Filters out elements with `data-screenshot-hide="1"` (the widget itself, debug overlays)
  - Replaces every `<video>` with a `<canvas>` of the same size (drawImage if readyState OK, else poster fallback) to dodge MSE/DASH `drawImage` returning a blank frame on Android Chrome
  - Replaces `<img>` elements with bogus `src` (data:text/html, page URLs the SW served wrongly) with empty canvases to keep html-to-image happy
  - Swallows global image-load errors during render so a single broken image can't fail the whole screenshot
  - Multiple retry passes with progressively more aggressive fallbacks (placeholders, skip fonts, skip iframes/audio)
- **Full-page mode** — captures the entire scrollable height up to 16,000 px (browser canvas limit)
- **Proxy external images** — optional pre-pass that fetches every cross-origin `<img>` through `/api/image-proxy` and inlines it as a data URL so the screenshot doesn't taint the canvas
- **Persistent preferences** — every toggle is stored in localStorage under `privacy_controls_v1`

## Element attributes you can use

| Attribute                          | Effect                                         |
|------------------------------------|------------------------------------------------|
| `data-pii`                         | Blur when "Blur PII" is on                     |
| `data-no-blur`                     | Never blur, even in privacy mode               |
| `data-blur-target="1"`             | Picker should pick THIS element, not its child |
| `data-manual-blur="1"`             | Set by the picker (you can also set manually)  |
| `data-screenshot-hide="1"`         | Excluded from the rendered screenshot          |
| `data-screenshot-keep`             | Always rendered even when blurred              |

## Install

```bash
cp components/PrivacyControls.tsx <app>/src/components/
cp styles/privacy.css <app>/src/app/
cp -r api/image-proxy <app>/src/app/api/

npm install html-to-image
```

Add the CSS in your `globals.css`:

```css
@import "./privacy.css";
```

Or paste the four rules from `privacy.css` directly.

Mount the widget once near the app root:

```tsx
import PrivacyControls from "@/components/PrivacyControls";

export default function DashboardShell({ children }) {
  return (
    <>
      {children}
      <PrivacyControls />
    </>
  );
}
```

## Caveats

- The screenshot widget is fixed at `bottom-3 right-3 z-[1100]` — adjust if it clashes with your layout
- iOS Safari has stricter canvas-taint rules; the `proxy external images` pre-pass is what makes external images work there
- Full-page mode briefly expands inner-scroll containers (`<main>` etc.) to their full height during capture. If your layout depends on a fixed-height scroller for sub-components, those may look off during the capture frame
