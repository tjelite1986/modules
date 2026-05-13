import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Generic time-entry table. The full source had `projectId` (FK to a projects
 * table) and Swedish-specific overtime classes — both kept here as optional
 * so the module is portable. Drop or extend per project.
 */
export const timeEntries = sqliteTable("time_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  /** Optional FK to a `projects` table — leave null if not used. */
  projectId: integer("project_id"),
  /** YYYY-MM-DD (local date — never toISOString). */
  date: text("date").notNull(),
  /** Decimal hours worked after subtracting break time. */
  hours: real("hours").notNull(),
  /** HH:MM */
  startTime: text("start_time"),
  /** HH:MM */
  endTime: text("end_time"),
  /** Total break minutes (sum of breakPeriods if those are used). */
  breakMinutes: integer("break_minutes").default(0),
  /** JSON array of {start, end} for multi-break shifts. See lib/break-periods.ts. */
  breakPeriods: text("break_periods"),
  /** "work" by default; "sick"/"vacation"/etc. if your app needs more types. */
  entryType: text("entry_type").notNull().default("work"),
  /** Free-form overtime classification. The source uses Swedish handels labels — keep generic. */
  overtimeType: text("overtime_type").notNull().default("none"),
  description: text("description"),
  /** JSON array of {department, startTime, endTime} for tasks split inside a shift. See lib/task-segments.ts. */
  taskSegments: text("task_segments"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
