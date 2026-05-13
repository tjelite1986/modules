# live-chat

Realtime chat over Socket.IO. Supports messages, typing indicators, emoji reactions, edit, delete, reply-to, expiring messages, and @mentions.

## What's included

- `lib/chat-socket.js` — server-side Socket.IO handlers
- `lib/types.ts` — TypeScript types (`Message`, `TypingUser`, `SendMessagePayload`)
- `hooks/useChat.ts` — React hook giving you everything you need for a chat component
- `api/messages/list/route.ts` — `GET /api/channels/[id]/messages` — history (1000 most recent)
- `api/messages/[id]/route.ts` — `PATCH` (edit) and `DELETE` (own messages or admin)
- `db/schema.sql` — `messages` and `reactions` tables

## Dependencies

**Other modules:** `authentication` (JWT, users table), `presence-system` (`onlineUsers` Map)

**Existing table:** Requires a `channels` table to exist. Use the channel-management module, or use the minimal version commented out in `db/schema.sql`.

## Installation

### 1. Install npm deps
```bash
npm install socket.io@^4 socket.io-client@^4 jsonwebtoken@^9.0.2
```

### 2. Run DB migration
```bash
sqlite3 data/app.db < db/migrations/003_chat.sql
```

### 3. server.js — wire up handlers

```js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { attachPresence } = require('./src/lib/presence-socket');
const { attachChatHandlers, startExpiredMessagesCleanup } = require('./src/lib/chat-socket');
const { getDb } = require('./src/lib/db');

const db = getDb();
const io = new Server(httpServer, { cors: { origin: '*' } });
global._io = io;  // required for REST edit/delete broadcast
const onlineUsers = new Map();

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
  attachChatHandlers(io, db, socket, onlineUsers);
});

startExpiredMessagesCleanup(db);
```

### 4. Client — minimal chat component

```tsx
'use client';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChat } from '@/hooks/useChat';

export function ChatRoom({ channelId }: { channelId: number }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const s = io({ auth: { token } });
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  const { messages, typingUsers, sendMessage, startTyping, addReaction, deleteMessage } =
    useChat(socket, { channelId });

  return (
    <div>
      <div>
        {messages.map(m => (
          <div key={m.id}>
            <strong>{m.username}:</strong> {m.content}
            {m.editedAt && <em> (edited)</em>}
            <button onClick={() => addReaction(m.id, 'thumbs-up')}>+1</button>
            {Object.entries(m.reactions).map(([emoji, users]) => (
              <span key={emoji}>{emoji} {users.length}</span>
            ))}
          </div>
        ))}
      </div>
      {typingUsers.length > 0 && <p>{typingUsers.map(u => u.username).join(', ')} typing...</p>}
      <input
        value={input}
        onChange={e => { setInput(e.target.value); startTyping(); }}
        onKeyDown={e => {
          if (e.key === 'Enter' && input.trim()) {
            sendMessage({ content: input });
            setInput('');
          }
        }}
      />
    </div>
  );
}
```

## Events contract

**Server emits:**
- `new-message` `Message` — to all in the channel
- `typing` / `stopped-typing` `TypingUser` / `{ userId, channelId }`
- `reaction-update` `{ messageId, reactions }`
- `mention` `{ fromUsername, channelId, messageId }` — sent only to the mentioned user
- `message-edited` `{ messageId, content, editedAt, channelId }`
- `message-deleted` `{ messageId, channelId }`

**Server listens for:**
- `join-channel` / `leave-channel` `channelId`
- `send-message` `SendMessagePayload`
- `typing-start` / `typing-stop` `channelId`
- `add-reaction` / `remove-reaction` `{ messageId, emoji }`

## Customization

- **Max history per fetch**: change `LIMIT 1000` in `api/messages/list/route.ts`
- **Mentions format**: regex `/@(\w+)/g` in `chat-socket.js` — adjust if you want to support spaces
- **Cleanup interval for expiring messages**: change `60_000` (ms) in `startExpiredMessagesCleanup`
- **Reaction emojis**: no server-side restriction — the UI controls the available set

## Reference UI

Components (`ChatWindow`, `MessageInput`, `MessageItem`) live in the elitemess project under `src/components/`. They are 1500+ lines and tightly coupled to elitemess UI/Tailwind. Cherry-pick what you want — use the `useChat` hook as the backbone.

## Limitations

- Always fetches the 1000 most recent — no pagination yet
- No read receipts (the separate `direct-messaging` module has them for DMs)
- Mentions require the user to be online to receive a notification (combine with a notifications module for push)
