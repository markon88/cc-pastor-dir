CREATE TABLE IF NOT EXISTS allowed_emails (
  email      TEXT PRIMARY KEY,
  added_by   TEXT,
  created_at TEXT DEFAULT (datetime('now'))
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
  id            TEXT PRIMARY KEY,
  last_name     TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  email         TEXT,
  birthday      TEXT,
  street        TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  primary_phone TEXT,
  active        INTEGER DEFAULT 1
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
  pastor_id   TEXT NOT NULL,
  church_name TEXT NOT NULL,
  PRIMARY KEY (pastor_id, church_name)
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
