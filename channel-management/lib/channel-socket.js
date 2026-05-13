/**
 * Channel-management server-side handlers for Socket.IO.
 *
 * Call attachChannelHandlers(io, db, socket) inside io.on('connection').
 *
 * Events emitted:
 *   - 'channel-created' Channel
 *
 * Events listened for:
 *   - 'create-channel' { name, description, categoryId }
 *
 * (For DELETE/PATCH the REST routes are used and broadcast via global._io.)
 */

function attachChannelHandlers(io, db, socket) {
  const { id: userId } = socket.user;

  socket.on('create-channel', ({ name, description, categoryId }) => {
    if (!name?.trim()) return;
    try {
      const result = db.prepare(
        'INSERT INTO channels (name, description, created_by, is_dm, category_id) VALUES (?, ?, ?, 0, ?)'
      ).run(name.trim(), description?.trim() || null, userId, categoryId || null);
      const channel = {
        id: result.lastInsertRowid,
        name: name.trim(),
        description: description?.trim(),
        isDm: false,
        createdBy: userId,
        categoryId: categoryId || null,
      };
      io.emit('channel-created', channel);
    } catch {}
  });
}

module.exports = { attachChannelHandlers };
