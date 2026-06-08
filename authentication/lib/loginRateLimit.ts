import { getDb } from "./db";

const SCRUB_AFTER_MS = 24 * 60 * 60 * 1000; // forget counters after 1 day idle

// Lockout ladder: failed_count -> lock duration (ms).
// 1-4 attempts: no lock yet (response is still 401, so an attacker cannot
// distinguish "wrong password" from "rate-limited" until the 5th try).
const LOCKOUT_LADDER: Array<{ atFails: number; durationMs: number }> = [
  { atFails: 5, durationMs: 5 * 60 * 1000 },       // 5 min
  { atFails: 10, durationMs: 30 * 60 * 1000 },     // 30 min
  { atFails: 20, durationMs: 4 * 60 * 60 * 1000 }, // 4 h
];

function lockDurationFor(failedCount: number): number {
  let duration = 0;
  for (const step of LOCKOUT_LADDER) {
    if (failedCount >= step.atFails) duration = step.durationMs;
  }
  return duration;
}

function scrubOld(now: number) {
  const db = getDb();
  db.prepare("DELETE FROM login_attempts WHERE last_attempt_at < ?").run(now - SCRUB_AFTER_MS);
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

export function checkAllowed(identifier: string): RateLimitResult {
  const key = identifier.toLowerCase();
  const now = Date.now();
  scrubOld(now);
  const db = getDb();
  const row = db.prepare("SELECT locked_until FROM login_attempts WHERE identifier = ?")
    .get(key) as { locked_until: number | null } | undefined;
  if (!row || row.locked_until == null) return { allowed: true };
  if (row.locked_until <= now) return { allowed: true };
  return { allowed: false, retryAfterSec: Math.ceil((row.locked_until - now) / 1000) };
}

export function recordFailure(identifier: string): void {
  const key = identifier.toLowerCase();
  const now = Date.now();
  const db = getDb();
  const existing = db.prepare(
    "SELECT failed_count FROM login_attempts WHERE identifier = ?",
  ).get(key) as { failed_count: number } | undefined;
  const nextCount = (existing?.failed_count ?? 0) + 1;
  const lockMs = lockDurationFor(nextCount);
  const lockedUntil = lockMs > 0 ? now + lockMs : null;
  db.prepare(
    `INSERT INTO login_attempts (identifier, failed_count, locked_until, first_failed_at, last_attempt_at)
     VALUES (?, 1, ?, ?, ?)
     ON CONFLICT(identifier) DO UPDATE SET
       failed_count = failed_count + 1,
       locked_until = excluded.locked_until,
       last_attempt_at = excluded.last_attempt_at`,
  ).run(key, lockedUntil, now, now);
}

export function recordSuccess(identifier: string): void {
  const key = identifier.toLowerCase();
  getDb().prepare("DELETE FROM login_attempts WHERE identifier = ?").run(key);
}
