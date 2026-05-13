import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, "app.db");

declare global {
  // eslint-disable-next-line no-var
  var __downloadsDb: Database.Database | undefined;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL,
    app_name TEXT NOT NULL,
    version TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`,
];

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  for (const stmt of SCHEMA) db.prepare(stmt).run();
}

export function getDownloadsDb(): Database.Database {
  if (!global.__downloadsDb) {
    const db = new Database(dbPath);
    init(db);
    global.__downloadsDb = db;
  }
  return global.__downloadsDb;
}

export function recordDownload(args: {
  userId: number | null;
  type: string;
  appName: string;
  version: string;
  fileName: string;
}) {
  getDownloadsDb()
    .prepare(
      "INSERT INTO downloads (user_id, type, app_name, version, file_name) VALUES (?, ?, ?, ?, ?)",
    )
    .run(args.userId, args.type, args.appName, args.version, args.fileName);
}

export type DownloadRow = {
  id: number;
  user_id: number | null;
  type: string;
  app_name: string;
  version: string;
  file_name: string;
  created_at: number;
};

export function listRecentDownloads(limit = 100): DownloadRow[] {
  return getDownloadsDb()
    .prepare("SELECT * FROM downloads ORDER BY created_at DESC LIMIT ?")
    .all(limit) as DownloadRow[];
}
