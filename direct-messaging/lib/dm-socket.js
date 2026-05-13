/**
 * Direct-messaging server-side handlers for Socket.IO.
 *
 * Call attachDmHandlers(io, db, socket, onlineUsers).
 *
 * Events emitted:
 *   - 'dm-created' Channel  (sent to both parties when a DM is created)
 *   - 'read-receipt' { channelId, userId, lastReadMessageId, readAt }  (sent to other DM members)
 *
 * Events listened for:
 *   - 'create-dm' targetUserId
 *   - 'mark-read' { channelId, messageId }
 */

function attachDmHandlers(io, db, socket, onlineUsers) {
  const { id: userId } = socket.user;

  socket.on('create-dm', (targetUserId) => {
    const minId = Math.min(userId, targetUserId);
    const maxId = Math.max(userId, targetUserId);
    const dmName = `dm_${minId}_${maxId}`;

    let channel = db.prepare("SELECT * FROM channels WHERE name = ?").get(dmName);
    if (!channel) {
      const result = db.prepare(
        "INSERT INTO channels (name, is_dm, created_by) VALUES (?, 1, ?)"
      ).run(dmName, userId);
      db.prepare("INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)").run(result.lastInsertRowid, userId);
      db.prepare("INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)").run(result.lastInsertRowid, targetUserId);
      channel = db.prepare("SELECT * FROM channels WHERE id = ?").get(result.lastInsertRowid);
    }

    const channelOut = { id: channel.id, name: channel.name, isDm: true, createdBy: channel.created_by };

    socket.emit('dm-created', channelOut);
    const targetSocket = onlineUsers.get(targetUserId);
    if (targetSocket) {
      io.to(targetSocket).emit('dm-created', channelOut);
    }
  });

  socket.on('mark-read', ({ channelId, messageId }) => {
    const ch = db.prepare('SELECT is_dm FROM channels WHERE id = ?').get(channelId);
    if (!ch?.is_dm) return;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO dm_read (channel_id, user_id, last_read_message_id, read_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(channel_id, user_id) DO UPDATE SET
        last_read_message_id = CASE WHEN excluded.last_read_message_id > last_read_message_id
          THEN excluded.last_read_message_id ELSE last_read_message_id END,
        read_at = CASE WHEN excluded.last_read_message_id > last_read_message_id
          THEN excluded.read_at ELSE read_at END
    `).run(channelId, userId, messageId, now);

    const members = db.prepare(
      'SELECT user_id FROM channel_members WHERE channel_id = ? AND user_id != ?'
    ).all(channelId, userId);
    for (const m of members) {
      const ts = onlineUsers.get(m.user_id);
      if (ts) io.to(ts).emit('read-receipt', { channelId, userId, lastReadMessageId: messageId, readAt: now });
    }
  });
}

module.exports = { attachDmHandlers };
