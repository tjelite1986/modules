-- Optional PIN that gates access to /shorts18 (Shorties Adults).
-- Hash is bcrypt of the cleartext PIN; when NULL the user has no PIN
-- and the page is accessible without prompt.
ALTER TABLE users ADD COLUMN adults_pin_hash TEXT;
