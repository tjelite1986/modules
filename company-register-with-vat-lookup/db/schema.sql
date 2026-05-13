-- Raw SQL equivalent of the Drizzle schema in db/schema.ts.

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_number TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  organisation_number TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  payment_terms TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_companies_organisation_number ON companies(organisation_number);
