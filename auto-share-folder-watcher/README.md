# auto-share-folder-watcher

Watches folders on the filesystem and auto-shares new files to a chat channel as messages. Useful for: sharing camera uploads from Syncthing/Nextcloud directly into a chat group, sharing screenshots from a specific folder, etc.

## How it works

1. A row in `folder_config` says folder `<id>` should be auto-shared to `autoshare_channel_id`
2. The watcher polls the folder every 5 seconds
3. When a new file appears and is **stable** (same size for two cycles in a row — to avoid sharing half-copied files) a row is inserted into `messages` and Socket.IO broadcasts `new-message`
4. HEIC/HEIF files are converted to JPEG if `heic-convert` is available

## Dependencies
- **authentication** + **channel-management** + **live-chat** + **file-upload-storage**

## Installation

```js
// In server.js, after io is up and all socket handlers are attached:
const { setupFolderWatchers } = require('./src/lib/folder-watcher');
const watcher = setupFolderWatchers(io, db);
global._syncWatchers = watcher.syncWatchers;  // lets /api/folders trigger re-sync
```

## Configure autoshare

```bash
# PATCH /api/folders/[id]
curl -X PATCH http://localhost:3000/api/folders/photo \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "autoshareChannelId": 42 }'
```

The watcher resyncs itself every 30 seconds AND when you PATCH (if `global._syncWatchers` is set).

## Customization

```js
setupFolderWatchers(io, db, {
  uploadsRoot: '/custom/path',
  pollMs: 2000,        // how often each folder is scanned
  syncMs: 60000,       // how often the config is reloaded
  typeMap: { mp3: 'audio', wav: 'audio', ...DEFAULT_TYPE_MAP }, // custom file types
});
```

## Limitations

- Polling, not inotify — on Linux, 5s polling is plenty
- Stability check: 2 cycles = up to ~10s delay before a file is shared (safety > speed)
- Auto-share user must be set (in the UI it becomes the user who enabled autoshare)
