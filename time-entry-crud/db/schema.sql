-- Raw SQL equivalent of the Drizzle schema in db/schema.ts.

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  project_id INTEGER,
  date TEXT NOT NULL,
  hours REAL NOT NULL,
  start_time TEXT,
  end_time TEXT,
  break_minutes INTEGER DEFAULT 0,
  break_periods TEXT,
  entry_type TEXT NOT NULL DEFAULT 'work',
  overtime_type TEXT NOT NULL DEFAULT 'none',
  description TEXT,
  task_segments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
