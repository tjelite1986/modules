/**
 * Task segments — split a single shift into multiple labelled segments
 * (e.g. department / activity rotations within one workday). Stored as a
 * JSON column.
 */

export interface TaskSegment {
  /** Free-form label (e.g. department name, activity, project sub-task). */
  department: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export function parseTaskSegments(json: string | null | undefined): TaskSegment[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is TaskSegment =>
        typeof s === "object" &&
        s !== null &&
        typeof s.department === "string" &&
        typeof s.startTime === "string" &&
        typeof s.endTime === "string",
    );
  } catch {
    return [];
  }
}

export function serializeTaskSegments(segments: TaskSegment[]): string | null {
  if (segments.length === 0) return null;
  return JSON.stringify(segments);
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Validate that every segment fits inside the parent shift and that
 * segments don't overlap each other. Returns warnings as plain strings —
 * surface them in the UI rather than throwing.
 */
export function validateSegments(
  segments: TaskSegment[],
  shiftStart: string,
  shiftEnd: string,
): { warnings: string[] } {
  const warnings: string[] = [];
  if (segments.length === 0) return { warnings };

  const shiftStartMin = timeToMinutes(shiftStart);
  let shiftEndMin = timeToMinutes(shiftEnd);
  if (shiftEndMin <= shiftStartMin) shiftEndMin += 1440; // overnight

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg.startTime || !seg.endTime) continue;

    const segStart = timeToMinutes(seg.startTime);
    let segEnd = timeToMinutes(seg.endTime);
    if (segEnd <= segStart) segEnd += 1440;

    if (segStart < shiftStartMin || segEnd > shiftEndMin) {
      warnings.push(
        `Segment "${seg.department}" (${seg.startTime}-${seg.endTime}) is outside the shift.`,
      );
    }

    if (i + 1 < segments.length) {
      const next = segments[i + 1];
      if (!next.startTime) continue;
      const nextStart = timeToMinutes(next.startTime);
      if (segEnd > nextStart) {
        warnings.push(
          `Overlap between "${seg.department}" and "${next.department}".`,
        );
      }
    }
  }

  return { warnings };
}
