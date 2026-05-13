/**
 * Live-chat server-side handlers for Socket.IO.
 *
 * Call attachChatHandlers(io, db, socket, onlineUsers) from your connection handler.
 *
 * Events emitted:
 *   - 'new-message' { id, channelId, userId, username, avatar, content, fileUrl, ..., reactions }
 *   - 'typing' { userId, username, channelId }
 *   - 'stopped-typing' { userId, channelId }
 *   - 'reaction-update' { messageId, reactions }
 *   - 'mention' { fromUsername, channelId, messageId }   (sent only to the mentioned user)
 *
 * Events listened for:
 *   - 'join-channel' channelId
 *   - 'leave-channel' channelId
 *   - 'send-message' { channelId, content, replyTo, expiresIn, fileUrl, fileType, fileName, fileSize }
 *   - 'typing-start' channelId
 *   - 'typing-stop' channelId
 *   - 'add-reaction' { messageId, emoji }
 *   - 'remove-reaction' { messageId, emoji }
 */

function getReactions(db, messageId) {
  const rows = db.prepare(
    'SELECT r.emoji, u.username FROM reactions r JOIN users u ON r.user_id = u.id WHERE r.message_id = ?'
  ).all(messageId);
  const result = {};
  for (const row of rows) {
    if (!result[row.emoji]) result[row.emoji] = [];
    result[row.emoji].push(row.username);
  }
  return result;
}

function attachChatHandlers(io, db, socket, onlineUsers) {
  const { id: userId, username } = socket.user;

  socket.on('join-channel', (channelId) => {
    socket.join(`ch:${channelId}`);
  });

  socket.on('leave-channel', (channelId) => {
    socket.leave(`ch:${channelId}`);
  });

  socket.on('send-message', ({ channelId, content, replyTo, expiresIn, fileUrl, fileType, fileName, fileSize }) => {
    if (!content?.trim() && !fileUrl) return;
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    const result = db.prepare(
      'INSERT INTO messages (channel_id, user_id, content, file_url, file_type, file_name, file_size, reply_to, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(channelId, userId, content?.trim() || '', fileUrl || null, fileType || null, fileName || null, fileSize || null, replyTo || null, expiresAt);

    const message = db.prepare(
      'SELECT m.*, u.username, u.avatar FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?'
    ).get(result.lastInsertRowid);

    let replyToContent, replyToUsername;
    if (replyTo) {
      const parent = db.prepare(
        'SELECT m.content, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?'
      ).get(replyTo);
      replyToContent = parent?.content;
      replyToUsername = parent?.username;
    }

    io.to(`ch:${channelId}`).emit('new-message', {
      id: message.id,
      channelId: message.channel_id,
      userId: message.user_id,
      username: message.username,
      avatar: message.avatar ?? undefined,
      content: message.content,
      fileUrl: message.file_url,
      fileType: message.file_type,
      fileName: message.file_name,
      fileSize: message.file_size,
      replyTo: message.reply_to,
      replyToContent,
      replyToUsername,
      expiresAt: message.expires_at,
      createdAt: message.created_at,
      reactions: {},
    });

    // Send mention notification to mentioned users (if online)
    const mentionedNames = [...new Set((content?.match(/@(\w+)/g) || []).map(m => m.slice(1)))];
    for (const name of mentionedNames) {
      const mentioned = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
      if (mentioned && mentioned.id !== userId) {
        const targetSocket = onlineUsers.get(mentioned.id);
        if (targetSocket) {
          io.to(targetSocket).emit('mention', { fromUsername: username, channelId, messageId: message.id });
        }
      }
    }
  });

  socket.on('typing-start', (channelId) => {
    socket.to(`ch:${channelId}`).emit('typing', { userId, username, channelId });
  });

  socket.on('typing-stop', (channelId) => {
    socket.to(`ch:${channelId}`).emit('stopped-typing', { userId, channelId });
  });

  socket.on('add-reaction', ({ messageId, emoji }) => {
    try {
      db.prepare('INSERT OR IGNORE INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)').run(messageId, userId, emoji);
    } catch {}
    const msg = db.prepare('SELECT channel_id FROM messages WHERE id = ?').get(messageId);
    if (!msg) return;
    io.to(`ch:${msg.channel_id}`).emit('reaction-update', { messageId, reactions: getReactions(db, messageId) });
  });

  socket.on('remove-reaction', ({ messageId, emoji }) => {
    db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(messageId, userId, emoji);
    const msg = db.prepare('SELECT channel_id FROM messages WHERE id = ?').get(messageId);
    if (!msg) return;
    io.to(`ch:${msg.channel_id}`).emit('reaction-update', { messageId, reactions: getReactions(db, messageId) });
  });
}

/**
 * Cleanup job — call once at server startup.
 * Deletes expired messages every 60 seconds.
 */
function startExpiredMessagesCleanup(db) {
  return setInterval(() => {
    db.prepare("DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < datetime('now')").run();
  }, 60_000);
}

module.exports = { attachChatHandlers, startExpiredMessagesCleanup, getReactions };
