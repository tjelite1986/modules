/**
 * Auto-share-folder-watcher.
 *
 * Watches folders configured in the `folder_config` table (from file-upload-storage).
 * When a new stable file appears, inserts a row into `messages` and broadcasts 'new-message'
 * to the configured channel. Uses the same format as the live-chat module's send-message.
 *
 * Call setupFolderWatchers(io, db) once after the server is up.
 * It returns a `syncWatchers()` function that you can expose as global._syncWatchers
 * so the API route `/api/folders/[id]` can trigger re-sync when the config changes.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_TYPE_MAP = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', heic: 'image', heif: 'image',
  mp4: 'video', mov: 'video',
};

function setupFolderWatchers(io, db, options = {}) {
  const UPLOADS_ROOT = options.uploadsRoot || process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  const TYPE_MAP = options.typeMap || DEFAULT_TYPE_MAP;
  const POLL_INTERVAL = options.pollMs || 5000;
  const SYNC_INTERVAL = options.syncMs || 30000;

  // Soft dependency: HEIC conversion if the package exists and file-upload-storage is installed
  let convertHeicIfNeeded = null;
  try {
    convertHeicIfNeeded = require('./heicConvert').convertHeicIfNeeded;
  } catch {}

  const activeWatchers = new Map();

  async function autoShareFile(filePath, filename, channelId, userId) {
    if (!fs.existsSync(filePath)) return;
    let stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) return;
    let ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if ((ext === 'heic' || ext === 'heif') && convertHeicIfNeeded) {
      try {
        const conv = await convertHeicIfNeeded(filePath);
        filePath = conv.path;
        filename = conv.filename;
        ext = conv.ext;
        stat = fs.statSync(filePath);
      } catch (e) {
        console.error('> HEIC conversion failed:', e.message);
        return;
      }
    }
    const fileType = TYPE_MAP[ext] ?? 'file';
    const fileUrl = `/api/uploads/${filename}`;
    try {
      const result = db.prepare(
        'INSERT INTO messages (channel_id, user_id, content, file_url, file_type, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(channelId, userId, '', fileUrl, fileType, filename, stat.size);
      const message = db.prepare(
        'SELECT m.*, u.username, u.avatar FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?'
      ).get(result.lastInsertRowid);
      if (!message) return;
      io.to(`ch:${channelId}`).emit('new-message', {
        id: message.id, channelId: message.channel_id, userId: message.user_id,
        username: message.username, avatar: message.avatar ?? undefined,
        content: '', fileUrl: message.file_url,
        fileType: message.file_type, fileName: message.file_name, fileSize: message.file_size,
        createdAt: message.created_at, reactions: {},
      });
      console.log(`> Auto-share: ${filename} -> channel ${channelId}`);
    } catch (e) {
      console.error('> Auto-share error:', e.message);
    }
  }

  function startWatcher(folderId, channelId, userId) {
    const folderPath = path.join(UPLOADS_ROOT, folderId);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      try { fs.chmodSync(folderPath, 0o777); } catch {}
    }

    // Build "already shared" from the DB so restarts don't lose files
    const sharedRows = db.prepare(
      "SELECT file_url FROM messages WHERE channel_id = ? AND file_url LIKE '/api/uploads/%'"
    ).all(channelId);
    const knownFiles = new Set(sharedRows.map(r => r.file_url.replace('/api/uploads/', '')));
    const sizeProbe = new Map();

    const intervalId = setInterval(() => {
      if (!fs.existsSync(folderPath)) return;
      let current;
      try { current = fs.readdirSync(folderPath); } catch { return; }

      for (const filename of current) {
        if (knownFiles.has(filename)) continue;
        const fp = path.join(folderPath, filename);
        let size;
        try { size = fs.statSync(fp).size; } catch { continue; }
        if (size === 0) continue;

        const prev = sizeProbe.get(filename);
        if (prev === size) {
          // File is stable — share it
          knownFiles.add(filename);
          sizeProbe.delete(filename);
          autoShareFile(fp, filename, channelId, userId).catch(e => console.error('> Auto-share error:', e.message));
        } else {
          sizeProbe.set(filename, size);
        }
      }
      const currentSet = new Set(current);
      for (const f of sizeProbe.keys()) {
        if (!currentSet.has(f)) sizeProbe.delete(f);
      }
    }, POLL_INTERVAL);

    activeWatchers.set(folderId, intervalId);
  }

  function syncWatchers() {
    const configs = db.prepare(
      'SELECT * FROM folder_config WHERE autoshare_channel_id IS NOT NULL AND autoshare_user_id IS NOT NULL'
    ).all();
    const configIds = new Set(configs.map(c => c.id));

    for (const [folderId, intervalId] of activeWatchers) {
      if (!configIds.has(folderId)) {
        clearInterval(intervalId);
        activeWatchers.delete(folderId);
        console.log(`> Stopped file watcher: ${folderId}`);
      }
    }

    for (const config of configs) {
      if (!activeWatchers.has(config.id)) {
        startWatcher(config.id, config.autoshare_channel_id, config.autoshare_user_id);
        console.log(`> Started file watcher: ${config.id} -> channel ${config.autoshare_channel_id}`);
      }
    }
  }

  syncWatchers();
  const syncInterval = setInterval(syncWatchers, SYNC_INTERVAL);

  return {
    syncWatchers,
    stop() {
      clearInterval(syncInterval);
      for (const intervalId of activeWatchers.values()) clearInterval(intervalId);
      activeWatchers.clear();
    },
  };
}

module.exports = { setupFolderWatchers };
