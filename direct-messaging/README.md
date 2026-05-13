# direct-messaging

DM channels between two users. Per-message read receipts, per-channel unread counter.

## What's included

- `lib/dm-socket.js` — `attachDmHandlers(io, db, socket, onlineUsers)`
- `api/channels/[id]/receipts/route.ts` — GET read receipts for a channel
- `api/unread/route.ts` — GET unread count per channel, POST mark channel as read
- `db/schema.sql` — `dm_read`, `channel_reads`

## Dependencies
authentication + channel-management + live-chat + presence-system

## How DMs work

DMs are regular channels with `is_dm = 1` and `name = "dm_<minId>_<maxId>"` (deterministic so duplicates can't be created). When `create-dm` is emitted:
1. The server creates or finds the channel
2. Both users are added as `channel_members`
3. Both receive a `dm-created` event and can join

## Read receipts

When the user calls `emit('mark-read', { channelId, messageId })`:
1. `dm_read.last_read_message_id` is updated (if the new id is larger)
2. Other DM members (if online) receive a `read-receipt` event

On the client — show "read" on messages where `messageId <= receipt.lastReadMessageId`.

## Unread counter

`channel_reads` is used for a coarse "unread per channel" counter (not per-message). Call `POST /api/unread` when the user opens a channel.
