# avatar-banner-upload

In-browser cropping + server-side storage for profile avatars and banners.

## Components

### `<Avatar />`

```tsx
<Avatar username="alice" avatar={user.avatar} size={48} />
```

- Shows the stored avatar if `avatar` is non-null
- Falls back to a deterministic gradient circle with the first initial when no avatar exists
- Sizes: pass any number; the component is square

### `<AvatarCropModal />`

```tsx
<AvatarCropModal
  open={open}
  onClose={() => setOpen(false)}
  onCrop={async (blob) => {
    const fd = new FormData();
    fd.append("file", blob, "avatar.png");
    await fetch("/api/avatars", { method: "POST", body: fd, headers: { Authorization: `Bearer ${token}` } });
  }}
  aspect={1}  // 1 for avatar, 4 for banner
/>
```

- Uses `react-easy-crop` for pan/zoom
- Returns a PNG Blob via the canvas API
- Aspect-ratio configurable

## Routes

- `POST /api/avatars` — multipart upload, stores `<userId>-<sha256>.png`, returns the new filename
- `DELETE /api/avatars` — removes the current avatar
- `POST /api/banners` — same for banners (wider crop)
- `DELETE /api/banners`

## Install

```bash
cp components/Avatar.tsx components/AvatarCropModal.tsx <app>/src/components/
cp -r api/avatars <app>/src/app/api/avatars
cp -r api/banners <app>/src/app/api/banners
npm install react-easy-crop
```

## Requires

- `authentication` module
- `file-upload-storage` module (uses its `UPLOAD_DIR` and helpers)
