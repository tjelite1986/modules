-- Per-user dashboard widgets. Each row is a configured widget owned by one
-- user. A widget can optionally be shared with specific other users via
-- widget_shares.

CREATE TABLE IF NOT EXISTS user_widgets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  widget_type TEXT NOT NULL,
  name        TEXT,
  config      TEXT NOT NULL DEFAULT '{}',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_widgets_user ON user_widgets(user_id, position);

CREATE TABLE IF NOT EXISTS widget_shares (
  widget_id            INTEGER NOT NULL,
  shared_with_user_id  INTEGER NOT NULL,
  shared_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (widget_id, shared_with_user_id),
  FOREIGN KEY (widget_id) REFERENCES user_widgets(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_widget_shares_user ON widget_shares(shared_with_user_id);
-- Per-viewer dashboard layout. Each viewer (user_id) gets to choose the
-- ordering of widgets visible to them, whether owned or shared. Falls back
-- to the widget's own `position` when no override row exists.

CREATE TABLE IF NOT EXISTS user_widget_layout (
  user_id    INTEGER NOT NULL,
  widget_id  INTEGER NOT NULL,
  position   INTEGER NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, widget_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (widget_id) REFERENCES user_widgets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_widget_layout_order
  ON user_widget_layout(user_id, position);
-- Per-user home page section layout. The `sections` column stores a JSON
-- array of `{ "key": string, "hidden": boolean }` entries describing the
-- order of sections and which ones the viewer has chosen to hide. When a
-- new section is added to the code base it is appended to the user's
-- order with `hidden: false` on the next read.

CREATE TABLE IF NOT EXISTS user_dashboard_layout (
  user_id    INTEGER PRIMARY KEY,
  sections   TEXT NOT NULL DEFAULT '[]',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
