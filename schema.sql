CREATE TABLE IF NOT EXISTS allowed_emails (
  email           TEXT PRIMARY KEY,
  added_by        TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  directory_email TEXT  -- maps login email to a pastor record email when they differ
);

CREATE TABLE IF NOT EXISTS user_activity (
  email       TEXT PRIMARY KEY,
  name        TEXT,
  picture     TEXT,
  first_login TEXT DEFAULT (datetime('now')),
  last_login  TEXT DEFAULT (datetime('now')),
  last_seen   TEXT DEFAULT (datetime('now')),
  login_count INTEGER DEFAULT 0,
  open_count  INTEGER DEFAULT 0,
  app_version TEXT,
  platform    TEXT
);

CREATE TABLE IF NOT EXISTS pastors (
  id             TEXT PRIMARY KEY,
  eadventist_id  TEXT,
  last_name      TEXT NOT NULL,
  first_name     TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  email          TEXT,
  birthday       TEXT,
  street         TEXT,
  city           TEXT,
  state          TEXT,
  zip            TEXT,
  primary_phone  TEXT,
  active         INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pastor_phones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  pastor_id    TEXT NOT NULL,
  number       TEXT NOT NULL,
  mobile       INTEGER DEFAULT 0,
  confidential INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS churches (
  name       TEXT PRIMARY KEY,
  org_id     TEXT,
  org_code   TEXT,
  region     TEXT,
  street     TEXT,
  city       TEXT,
  state      TEXT,
  zip        TEXT,
  membership INTEGER
);

CREATE TABLE IF NOT EXISTS ama_groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  leader_id  TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pastor_churches (
  pastor_id        TEXT NOT NULL,
  church_org_code  TEXT NOT NULL,
  PRIMARY KEY (pastor_id, church_org_code)
);

CREATE TABLE IF NOT EXISTS pastor_ama_groups (
  pastor_id TEXT NOT NULL,
  group_id  TEXT NOT NULL,
  PRIMARY KEY (pastor_id, group_id)
);

-- Stores data version for cache invalidation
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type   TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_name TEXT,
  details     TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log (created_at DESC);

CREATE TABLE IF NOT EXISTS ama_meetings (
  id         TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  date       TEXT NOT NULL,
  type       TEXT NOT NULL
);
