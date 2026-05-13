-- auth-nextauth module schema
-- Single users table with role-based access (user/admin).
-- The first admin is auto-seeded from ADMIN_USERNAME / ADMIN_PASSWORD env vars.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
