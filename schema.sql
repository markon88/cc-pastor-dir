CREATE TABLE IF NOT EXISTS allowed_emails (
  email      TEXT PRIMARY KEY,
  added_by   TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
