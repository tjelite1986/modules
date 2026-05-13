# bookmarks

Users can save messages for later. Bookmarks are personal (one per user/message).

## API

- `GET /api/bookmarks` — all my bookmarks with full message data
- `POST /api/bookmarks` `{ messageId }` — add
- `DELETE /api/bookmarks/[messageId]` — remove

## Dependencies
- **authentication**, **live-chat** (requires the `messages` table)

## Client usage

```ts
// List
const bookmarks = await fetch('/api/bookmarks', { headers }).then(r => r.json());

// Toggle
const isBookmarked = bookmarks.some(b => b.messageId === msg.id);
const url = isBookmarked ? `/api/bookmarks/${msg.id}` : '/api/bookmarks';
const method = isBookmarked ? 'DELETE' : 'POST';
await fetch(url, { method, headers, body: !isBookmarked ? JSON.stringify({ messageId: msg.id }) : undefined });
```
