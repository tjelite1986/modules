# message-search

GET `/api/search?q=text` — searches messages and filenames using `LIKE`. Respects DM membership (you only see DMs you're a member of).

## Dependencies
authentication + channel-management + live-chat

## Usage

```ts
const results = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
// [{ id, content, channelName, username, createdAt, ... }]
```

## Customization

- **Limit**: 40 hard-coded
- **Min query length**: 2 characters
- **Performance**: switch `LIKE` for SQLite FTS5 if you have many messages
