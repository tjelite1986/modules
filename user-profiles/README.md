# user-profiles

User profiles — bio, display name, email, password change, avatar upload, session management (remote logout).

## What's included

- `api/users/route.ts` — GET (list all users with status)
- `api/users/me/route.ts` — GET (own profile), PATCH (update fields / change password / upload avatar)
- `api/sessions/route.ts` — GET (my sessions with device parsing)
- `api/sessions/[id]/route.ts` — DELETE (log out a device)
- `api/avatars/[filename]/route.ts` — GET (serve avatar images)

## Dependencies

- **authentication** (required)
- **file-upload-storage** (soft — only for `getAvatarsDir`. Easy to inline yourself.)

## Installation

```bash
sqlite3 data/app.db < db/migrations/005_user_profiles.sql
```

If you don't install file-upload-storage, create `src/lib/uploadPaths.ts`:
```ts
import path from 'path';
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const getAvatarsDir = () => path.join(DATA_DIR, 'avatars');
```

## Client usage

```ts
// Get own profile
const me = await fetch('/api/users/me', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

// Update fields
await fetch('/api/users/me', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ displayName: 'Thomas', bio: 'Hello there' })
});

// Upload avatar
const fd = new FormData();
fd.append('avatar', fileInput.files[0]);
await fetch('/api/users/me', {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}` },
  body: fd
});

// Log out a specific device
await fetch(`/api/sessions/${sessionId}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` }
});
```

## Customization

- **Avatar max size**: 5 MB hard-coded in `users/me/route.ts` — change `5 * 1024 * 1024`
- **Allowed image formats**: `['jpg', 'jpeg', 'png', 'webp', 'gif']`
- **Password policy**: minimum 4 characters — stricter? Edit `users/me/route.ts`
