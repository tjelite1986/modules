# time-entry-crud

A complete time-tracking foundation: schema, API, calendar views, pickers, edit dialog. Generic enough to drop into any Next.js + Drizzle + NextAuth project and bend to your domain.

## What's included

- `db/schema.ts` — Drizzle table for `time_entries` (with `db/schema.sql` fallback)
- `api/route.ts` — `GET / POST / PUT / DELETE /api/time-entries`
- `lib/time-utils.ts` — pure helpers: `calculateWorkHours`, `calculateAutoBreak`, `getWeekNumber`, `generateBreakPeriod`
- `lib/break-periods.ts` — multi-break JSON column parsing
- `lib/task-segments.ts` — split-shift segments (with overlap warnings)
- `components/DatePicker.tsx` — Monday-first calendar dropdown with Today shortcut
- `components/TimePicker.tsx` — Material-style 24h analog clock + text fallback
- `components/TaskSegmentEditor.tsx` — collapsible segment editor with overlap detection
- `components/calendar/CalendarMonthView.tsx`
- `components/calendar/CalendarWeekView.tsx`
- `components/calendar/CalendarViewToggle.tsx`
- `components/dialogs/EditTimeEntryDialog.tsx` — full edit form wired to the API route

## Schema

```ts
time_entries (
  id, user_id,
  project_id,                       // optional FK
  date,                             // YYYY-MM-DD (local — never toISOString!)
  hours,                            // decimal hours, server-computed when start/end given
  start_time, end_time,             // HH:MM
  break_minutes,                    // sum if breakPeriods is set
  break_periods,                    // JSON [{start, end}, ...]
  entry_type,                       // "work" / "sick" / extend per project
  overtime_type,                    // free-form; UI defaults to handels-style
  description,
  task_segments,                    // JSON [{department, startTime, endTime}, ...]
  created_at
)
```

## Calendar

```tsx
import CalendarMonthView from "@/components/calendar/CalendarMonthView";
import CalendarViewToggle from "@/components/calendar/CalendarViewToggle";
import { getHolidays } from "@/lib/holidays"; // from swedish-tax-holidays (optional)

const [view, setView] = useState<"week" | "month">("week");

<CalendarViewToggle view={view} onChange={setView} />

<CalendarMonthView
  year={2026}
  month={4}
  entries={entries}                            // CalendarEntry[]
  redDays={getHolidays(2026)}                  // optional — highlights holidays
  onDayClick={(date, dayEntries) => { ... }}
  onEntryClick={(entry) => setEditing(entry)}
  onPrev={() => ...}
  onNext={() => ...}
  // optional schedule overlay:
  getScheduledEntry={(date, dayOfWeek) => yourLookup(date, dayOfWeek)}
  // optional currency formatter (default: "1234 kr"):
  formatSecondary={(v) => `$${v.toFixed(2)}`}
/>
```

`CalendarEntry` carries an optional `secondaryValue` field — useful when you want to render gross pay, billed amount, etc. next to the hours. The calendar doesn't know what it means.

## Pickers

```tsx
<DatePicker value={date} onChange={setDate} required />
<TimePicker value={startTime} onChange={setStartTime} placeholder="--:--" />
```

Both write back ISO-formatted local strings (`YYYY-MM-DD`, `HH:MM`). The TimePicker is a Material-style 24-hour analog clock with an outer ring (12 + 1-11) and an inner ring (00 + 13-23), plus a text-input fallback toggled by the keyboard icon.

## Edit dialog

```tsx
import EditTimeEntryDialog from "@/components/dialogs/EditTimeEntryDialog";

<EditTimeEntryDialog
  entry={editing}                              // TimeEntryDetail | null
  projects={projectList}                       // optional — hides project picker if empty
  departments={["Floor", "Stockroom", "Office"]} // optional — enables TaskSegmentEditor
  overtimeOptions={[                           // optional — override the handels-style defaults
    { value: "none", label: "None" },
    { value: "x1.5", label: "1.5×" },
    { value: "x2",   label: "2×" },
  ]}
  onClose={() => setEditing(null)}
  onSaved={() => refetch()}
/>
```

## Break helpers

```ts
import { calculateAutoBreak, calculateWorkHours } from "@/lib/time-utils";

// Default rules (4h→15, 6h→30, 8h→60) when no rules passed
calculateAutoBreak("08:00", "17:00");   // 60

// Custom rules
calculateAutoBreak("08:00", "12:00", [
  { minHours: 5, breakMinutes: 30 },
  { minHours: 8, breakMinutes: 60 },
]);  // 0 (4h shift, no rule met)

calculateWorkHours("08:00", "17:00", 60); // 8.0
```

## Date handling rule

**Always use local date components.** Never call `toISOString()` on a date you got from a date picker — it shifts to UTC and you'll be off by 1-2 hours depending on TZ. The schema's `date` column is plain `YYYY-MM-DD` text built from `getFullYear()` + `getMonth()` + `getDate()`. Stick to that pattern.

## Dependencies on other modules

- **Required**: `auth-nextauth` — for `authOptions` / session check on the API route.
- **Optional**: `swedish-tax-holidays` — pass `getHolidays(year)` to the calendar's `redDays` for holiday highlighting.

## Customization

- **Project picker** — pass an empty array (or omit) to hide it; the API still accepts `projectId`.
- **Overtime options** — defaults match the Swedish handels collective agreement labels; override per project.
- **Currency display** — `formatSecondary` prop on the calendar; default appends " kr".
- **Day labels** — calendar uses Mon/Tue/.../Sun; edit the `DAY_HEADERS` constant for other locales.
- **Auto-break rules** — pass per-user `BreakRule[]` from your settings table. Default rules are sane for office work.
