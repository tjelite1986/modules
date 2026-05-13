/**
 * Presence-system server-side handlers for Socket.IO.
 *
 * Call attachPresence(io, db, socket, onlineUsers) from your connection handler.
 * onlineUsers is a shared Map<userId, socketId> usable by multiple modules.
 *
 * Events emitted:
 *   - 'user-online' { userId, username }   broadcast on connect
 *   - 'user-offline' { userId, username }  broadcast on disconnect
 *   - 'online-users' [userId, ...]          sent to the connecting user
 *   - 'user-status-changed' { userId, status, statusText }  broadcast on set-status
 *
 * Events listened for:
 *   - 'set-status' { status, statusText }   status: 'online' | 'away' | 'dnd'
 */

const ALLOWED_STATUSES = ['online', 'away', 'dnd'];

function attachPresence(io, db, socket, onlineUsers) {
  const { id: userId, username } = socket.user;

  onlineUsers.set(userId, socket.id);
  db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
  socket.broadcast.emit('user-online', { userId, username });
  socket.emit('online-users', Array.from(onlineUsers.keys()));

  socket.on('set-status', ({ status, statusText }) => {
    if (!ALLOWED_STATUSES.includes(status)) return;
    db.prepare('UPDATE users SET status = ?, status_text = ? WHERE id = ?')
      .run(status, statusText || null, userId);
    io.emit('user-status-changed', { userId, status, statusText: statusText || null });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    io.emit('user-offline', { userId, username });
  });
}

module.exports = { attachPresence, ALLOWED_STATUSES };
