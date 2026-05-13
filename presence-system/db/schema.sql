-- Presence-system module schema
-- Adds online-status fields to existing users table.
-- Requires: authentication module (users table must exist)

-- Use ALTER TABLE since users already exists from auth module.
-- These will fail silently if columns already exist (run via try/catch in app):
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'online';
ALTER TABLE users ADD COLUMN status_text TEXT;
