# apk-management

Helpers for a sideload distribution page (`/download`) — APK versioning, auto-update for Capacitor clients, and smart icon extraction.

## What's included

- `lib/appVersion.ts` — `APP_VERSION` constant
- `lib/apkDownload.ts` — Capacitor client helper for downloading and opening an APK
- `GET /api/version` — returns the version from `LATEST_APK_VERSION` env or fallback `APP_VERSION`
- `GET /api/apk-icon/[filename]` — extracts `ic_launcher.png` from an APK with smart fallback for obfuscated APKs
- `GET /api/apk-icon/library` — list manual icons for obfuscated APKs
- `POST /api/apk-icon/upload` — pick or upload a manual icon
- `GET /api/apk-icon/library/[filename]` — serve a library icon

## Dependencies
- **authentication** + **file-upload-storage**

## How icon extraction works

1. First tries `res/mipmap-XXXhdpi/ic_launcher.png` (the standard path)
2. If the APK is obfuscated: scans all PNGs, finds square 48-192px ones (icon-sized), excludes `.9.png` (nine-patch)
3. Among candidates: prefers non-RGBA (those fill the whole square) and highest color variety
4. The icon is cached in `$UPLOADS_DIR/apk-icons/<filename>.png` — extracted only once per APK

## How version checking works

Client (Capacitor) starts the app → fetches `/api/version` → compares to the bundled version → if the server version is higher, downloads the APK with `downloadAndInstallApk()`.

## Customization

- **APP_VERSION**: hard-coded in `lib/appVersion.ts` — can be read dynamically from `package.json`
- **APK folders**: hardcoded `apk/` and `apk_games/` in `apk-icon/[filename]/route.ts` — add more if needed
- **Icon size**: 48-192px range in `extractApkIcon` — change if you have larger launcher icons
