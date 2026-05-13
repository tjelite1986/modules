import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, "app.db");

declare global {
  // eslint-disable-next-line no-var
  var __authNextauthDb: Database.Database | undefined;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`,
];

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  for (const stmt of SCHEMA) {
    db.prepare(stmt).run();
  }

  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminUser && adminPass) {
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(adminUser);
    if (!existing) {
      const hash = bcrypt.hashSync(adminPass, 10);
      db.prepare(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
      ).run(adminUser, hash);
      console.log(`[auth-nextauth] seeded admin user '${adminUser}'`);
    }
  }
}

export function getAuthDb(): Database.Database {
  if (!global.__authNextauthDb) {
    const db = new Database(dbPath);
    init(db);
    global.__authNextauthDb = db;
  }
  return global.__authNextauthDb;
}

export type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  role: "admin" | "user";
};

export function findUser(username: string): UserRow | undefined {
  return getAuthDb()
    .prepare("SELECT id, username, password_hash, role FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;
}
