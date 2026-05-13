-- Raw SQL equivalent of the Drizzle schema in db/schema.ts.

CREATE TABLE IF NOT EXISTS repair_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  receipt_number TEXT NOT NULL,
  intake_date TEXT NOT NULL,

  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  customer_postal_code TEXT,
  customer_city TEXT,
  ssn TEXT,
  customer_number TEXT,

  receipt_issuer TEXT NOT NULL,
  original_receipt_number TEXT,
  warranty INTEGER NOT NULL DEFAULT 0,
  inspection_requested INTEGER NOT NULL DEFAULT 0,

  store TEXT,
  store_city TEXT,

  article_number TEXT,
  item_name TEXT,

  fault_description TEXT,
  action TEXT,
  technician TEXT,
  max_cost REAL,
  action_date TEXT,
  comments TEXT,

  status TEXT NOT NULL DEFAULT 'intake',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_repair_receipts_user_id ON repair_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_repair_receipts_status ON repair_receipts(status);
CREATE INDEX IF NOT EXISTS idx_repair_receipts_customer_number ON repair_receipts(customer_number);
