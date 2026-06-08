-- Authentication module schema
-- Users, invite codes, sessions, and brute-force lockout tables

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  avatar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME
);

CREATE TABLE IF NOT EXISTS invite_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  created_by INTEGER NOT NULL,
  used_by INTEGER,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  jti TEXT NOT NULL UNIQUE,
  device_info TEXT,
  ip TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Brute-force throttle for the login endpoint.
-- Keyed on lowercased identifier (email or username) so each account has its
-- own counter. Rows older than 24h are scrubbed on read.
CREATE TABLE IF NOT EXISTS login_attempts (
  identifier        TEXT PRIMARY KEY,
  failed_count      INTEGER NOT NULL DEFAULT 0,
  locked_until      INTEGER,
  first_failed_at   INTEGER NOT NULL,
  last_attempt_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_last
  ON login_attempts(last_attempt_at);
