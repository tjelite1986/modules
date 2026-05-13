# channel-management

CRUD for channels, categories, and memberships. Supports banner/icon images, category sorting, and both public channels and DMs.

## What's included

- `lib/channel-socket.js` — socket handler for `create-channel`
- `api/channels/route.ts` — GET (list all the user's channels with last message)
- `api/channels/[id]/route.ts` — PATCH (admin), DELETE (admin)
- `api/channels/[id]/banner/route.ts` — POST banner image (requires file-upload-storage)
- `api/channels/[id]/icon/route.ts` — POST icon image (requires file-upload-storage)
- `api/categories/route.ts` — GET, POST (admin)
- `api/categories/[id]/route.ts` — PATCH, DELETE (admin)
- `db/schema.sql` — `channels`, `categories`, `channel_members`

## Dependencies

- **authentication** (required)
- **file-upload-storage** (optional — for banner/icon)

## Installation

```bash
sqlite3 data/app.db < db/migrations/004_channels.sql
```

In server.js (after presence + chat):
```js
const { attachChannelHandlers } = require('./src/lib/channel-socket');

io.on('connection', (socket) => {
  // ... presence, chat
  attachChannelHandlers(io, db, socket);
});
```

## Customization

- **Who can create channels**: currently any authenticated user — edit `lib/channel-socket.js` to restrict to admins
- **Default category "General"**: change in `db/schema.sql`
- **PATCH/DELETE require admin** — to let channel owners do it too, swap `verifyAdmin` for a custom check in the routes
