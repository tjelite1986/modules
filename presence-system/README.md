# presence-system

Realtime online/offline status, `last_seen`, and customizable statuses (online/away/dnd) via Socket.IO.

## What's included

- `lib/presence-socket.js` — `attachPresence(io, db, socket, onlineUsers)` server-side handler
- `hooks/usePresence.ts` — React hook that listens for presence events
- `db/schema.sql` — adds `status` and `status_text` to the `users` table

## Dependencies

**Other modules:** `authentication` (requires the `users` table and JWT for socket auth)

## Installation

### 1. Install npm deps
```bash
npm install socket.io@^4 socket.io-client@^4
```

### 2. Run DB migration
```bash
sqlite3 data/app.db < db/migrations/002_presence.sql
```
(Ignore "duplicate column" errors if you re-run the migration.)

### 3. server.js — wire up handlers

```js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { attachPresence } = require('./src/lib/presence-socket');
const { getDb } = require('./src/lib/db');

const db = getDb();
const io = new Server(httpServer, { cors: { origin: '*' } });
const onlineUsers = new Map();  // shared between presence + chat (etc.)

// JWT auth for sockets
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  attachPresence(io, db, socket, onlineUsers);
  // attach other modules here (e.g. live-chat)
});
```

### 4. Client — use the hook

```tsx
'use client';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { usePresence } from '@/hooks/usePresence';

export function ChatPage() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const s = io({ auth: { token } });
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  const { onlineUserIds, isOnline, setMyStatus } = usePresence(socket);

  return (
    <div>
      <p>Online now: {onlineUserIds.size}</p>
      <button onClick={() => setMyStatus('away')}>Set me as away</button>
      {/* Show a green dot if user is online */}
      {isOnline(42) && <span className="text-green-500">●</span>}
    </div>
  );
}
```

## Events contract

**Server emits:**
- `user-online` `{ userId, username }` — broadcast on connect
- `user-offline` `{ userId, username }` — broadcast on disconnect
- `online-users` `[userId, ...]` — sent directly to the connecting user
- `user-status-changed` `{ userId, status, statusText }` — broadcast on set-status

**Server listens for:**
- `set-status` `{ status: 'online'|'away'|'dnd', statusText?: string }`

## Customization

- **Add statuses**: edit `ALLOWED_STATUSES` in `presence-socket.js`
- **Persisted last-online**: `users.last_seen` is updated automatically on connect/disconnect — read it in your UI

## Limitations

- Uses an in-memory Map — does not survive server restarts (but sockets reconnect and re-establish state)
- For multi-server setups you need the Redis Adapter (`@socket.io/redis-adapter`) — not included
