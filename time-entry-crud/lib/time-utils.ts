/**
 * Pure helpers for working with HH:MM times and shift durations.
 * No I/O, no React. Safe to import from server, client, or edge.
 */

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Decimal hours worked from start/end times, minus the break minutes.
 * Handles overnight shifts (end ≤ start → wraps to next day).
 */
export function calculateWorkHours(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): number {
  let startMin = timeToMinutes(startTime);
  let endMin = timeToMinutes(endTime);
  if (endMin <= startMin) endMin += 24 * 60;
  const totalMinutes = endMin - startMin - breakMinutes;
  return Math.max(0, totalMinutes / 60);
}

/** A break-rule row: "if shift ≥ minHours, give breakMinutes break". */
export interface BreakRule {
  minHours: number;
  breakMinutes: number;
}

/**
 * Compute the auto-calculated break for a shift. Picks the first rule whose
 * `minHours` threshold the shift meets (rules are sorted from largest down).
 *
 * Default rules if `rules` is empty/undefined: 4h → 15min, 6h → 30min, 8h → 60min.
 */
export function calculateAutoBreak(
  startTime: string,
  endTime: string,
  rules?: BreakRule[],
): number {
  let startMin = timeToMinutes(startTime);
  let endMin = timeToMinutes(endTime);
  if (endMin <= startMin) endMin += 24 * 60;
  const totalHours = (endMin - startMin) / 60;

  if (rules && rules.length > 0) {
    const sorted = [...rules].sort((a, b) => b.minHours - a.minHours);
    const match = sorted.find((r) => totalHours >= r.minHours);
    return match ? match.breakMinutes : 0;
  }

  if (totalHours >= 8) return 60;
  if (totalHours >= 6) return 30;
  if (totalHours >= 4) return 15;
  return 0;
}

/**
 * Place a break of N minutes around the midpoint of a shift. Returns the
 * resulting `{start, end}` HH:MM strings, normalised to a 24h clock.
 */
export function generateBreakPeriod(
  startTime: string,
  endTime: string,
  breakMins: number,
): { start: string; end: string } {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let startTotal = sh * 60 + sm;
  let endTotal = eh * 60 + em;
  if (endTotal <= startTotal) endTotal += 1440;

  const midpoint = Math.floor((startTotal + endTotal) / 2);
  const bsMin = midpoint - Math.floor(breakMins / 2);
  const beMin = bsMin + breakMins;
  const bsNorm = ((bsMin % 1440) + 1440) % 1440;
  const beNorm = ((beMin % 1440) + 1440) % 1440;
  return {
    start: `${String(Math.floor(bsNorm / 60)).padStart(2, "0")}:${String(bsNorm % 60).padStart(2, "0")}`,
    end: `${String(Math.floor(beNorm / 60)).padStart(2, "0")}:${String(beNorm % 60).padStart(2, "0")}`,
  };
}

/** ISO week number (1-53) for a given Date — Monday start, Thursday-anchored. */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
