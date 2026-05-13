# social-feed

Posts, likes, comments. Supports media uploads and sharing chat messages to the feed.

## API

- `GET/POST /api/feed` — list (100 most recent) / create post
- `DELETE /api/feed/[id]` — delete (owner or admin)
- `GET/POST /api/feed/[id]/comments` — list / add comments
- `DELETE /api/feed/[id]/comments/[commentId]` — delete comment
- `POST /api/feed/[id]/like` — toggle like

## Dependencies
- **authentication** (required)
- **user-profiles** (soft — uses `display_name`)
- **live-chat** (soft — for the share-from-chat feature)
- **file-upload-storage** (soft — for media attachments)

## Realtime events
`new-feed-post`, `feed-post-deleted`, `feed-post-liked`, `feed-post-commented`, `feed-comment-deleted`

## Client usage

```ts
// Load the feed
const posts = await fetch('/api/feed', { headers }).then(r => r.json());

// Create a text post
await fetch('/api/feed', { method: 'POST', headers, body: JSON.stringify({ content: 'Hi!' }) });

// Create a post with an image (combine with file-upload)
const upload = await uploadFile(file);
await fetch('/api/feed', { method: 'POST', headers, body: JSON.stringify({
  content: 'Check this', mediaUrl: upload.url, mediaType: upload.type, mediaName: upload.name
})});

// Share a chat message
await fetch('/api/feed', { method: 'POST', headers, body: JSON.stringify({
  content: 'Lol this',
  sharedChannelId: msg.channelId,
  sharedChannelName: 'general',
  sharedMessageContent: msg.content,
  sharedMessageUsername: msg.username,
})});
```
