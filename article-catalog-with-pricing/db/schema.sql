-- Raw SQL equivalent of the Drizzle schema in db/schema.ts.

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price REAL,
  bundle_quantity INTEGER,
  bundle_price REAL,
  category TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
