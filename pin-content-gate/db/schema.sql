-- The PIN gate stores its bcrypt hash in a generic key/value settings table.
-- If you already have one, just use it — the routes only touch this table via
-- the `pin_hash_key` configurable below (default key: 'gate_pin_hash').

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
