# message-pinning

Pin important messages in a channel. Admin-only. Realtime broadcast via Socket.IO.

## API

- `GET /api/channels/[id]/pins` — list pinned messages
- `POST /api/channels/[id]/pins` `{ messageId }` — pin (admin)
- `DELETE /api/channels/[id]/pins` `{ messageId }` — unpin (admin)

## Dependencies
authentication + channel-management + live-chat

## Events (Socket.IO)
- `message-pinned` `{ channelId, pin }`
- `message-unpinned` `{ channelId, messageId }`

## Customization

Want to allow everyone in the channel to pin? Remove the `is_admin` check in route.ts.
