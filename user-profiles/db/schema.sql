-- User-profiles module schema
-- Adds bio and display_name to existing users table.
-- Requires: authentication module (users + sessions tables already exist)

ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;
