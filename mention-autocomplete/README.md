# mention-autocomplete

Autocomplete endpoint for @-mentions and #-channel references in a chat input.

## Usage

```ts
// User mentions
const users = await fetch(`/api/mention-suggestions?q=tho`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
// [{ id, username, avatar }, ...]

// Channel references
const channels = await fetch(`/api/mention-suggestions?q=gen&type=channel`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
// [{ id, name }, ...]
```

## Dependencies

- **authentication** (required)
- **channel-management** (soft — only when you use `?type=channel`)

## Customization

- **Limit**: hard-coded 8 — change `LIMIT 8` in route.ts
- **Match strategy**: `LIKE %q%` — for large datasets, switch to FTS5
