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

CREATE TABLE IF NOT EXISTS seen_announcements (
  email           TEXT NOT NULL,
  announcement_id TEXT NOT NULL,
  seen_at         TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (email, announcement_id)
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

-- Church-based AMA assignment (see migrations/016_church_ama_groups.sql) —
-- survives a pastor moving, retiring, or being replaced. Replaced the old
-- pastor-based pastor_ama_groups table (dropped in 018).
CREATE TABLE IF NOT EXISTS church_ama_groups (
  church_org_code TEXT PRIMARY KEY,
  group_id        TEXT NOT NULL
);

-- A pastor's personal AMA choice (see migrations/021_pastor_ama_preferences.sql)
-- — overrides the church-derived AMA for that pastor only, never their successor.
CREATE TABLE IF NOT EXISTS pastor_ama_preferences (
  pastor_id  TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  note       TEXT
);

-- Volunteer Lay Pastors (eAdventist office 84) and Volunteer Lay/Church Leaders
-- (office 122) — unpaid volunteer roles, kept separate from the pastors table
-- so they never appear in pastor search/listings, only on a dedicated Volunteers
-- tab and on the church detail page.
CREATE TABLE IF NOT EXISTS volunteers (
  eadventist_id   TEXT PRIMARY KEY,
  office_id       TEXT NOT NULL,
  office_name     TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  church_org_code TEXT NOT NULL
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

-- Conference offering plan, one row per Sabbath — printed on the per-church
-- Sundown Calendar PDF (see migrations/019_offering_schedule.sql).
CREATE TABLE IF NOT EXISTS offering_schedule (
  sabbath_date TEXT PRIMARY KEY,  -- YYYY-MM-DD, always a Saturday
  offering     TEXT NOT NULL,
  updated_by   TEXT,
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- Messages module (see migrations/023_messages.sql)
-- Who can use the Messages tab. can_send = 0 → can manage lists and write
-- drafts; can_send = 1 → can also send. ADMIN_EMAILS admins always can.
CREATE TABLE IF NOT EXISTS message_role_users (
  email      TEXT PRIMARY KEY,
  can_send   INTEGER NOT NULL DEFAULT 0,
  granted_by TEXT,
  granted_at TEXT DEFAULT (datetime('now')),
  revoked_at TEXT
);

-- Uploaded/maintained recipient lists. "All active pastors" is not stored
-- here — it's built live from the pastors table at send time.
CREATE TABLE IF NOT EXISTS message_lists (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  created_by  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message_contacts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id      INTEGER NOT NULL,
  email        TEXT NOT NULL,
  first_name   TEXT,
  last_name    TEXT,
  organization TEXT,   -- church or school; merge field {{{organization}}}
  added_by     TEXT,
  added_at     TEXT DEFAULT (datetime('now')),
  UNIQUE (list_id, email)
);
CREATE INDEX IF NOT EXISTS idx_message_contacts_list ON message_contacts(list_id);

-- One row per message. audience is JSON: ["pastors", 3, 7] (list ids).
-- status: draft → importing (contacts uploading to Resend) → sending → sent,
-- or failed (see error).
CREATE TABLE IF NOT EXISTS message_campaigns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  subject             TEXT NOT NULL DEFAULT '',
  body                TEXT NOT NULL DEFAULT '',
  from_name           TEXT,
  header              TEXT,  -- banner text; blank = sender name (migrations/024)
  reply_to            TEXT,
  audience            TEXT NOT NULL DEFAULT '[]',
  status              TEXT NOT NULL DEFAULT 'draft',
  recipient_count     INTEGER,
  resend_segment_id   TEXT,
  resend_import_id    TEXT,
  resend_broadcast_id TEXT,
  error               TEXT,
  created_by          TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_by          TEXT,
  updated_at          TEXT DEFAULT (datetime('now')),
  sent_by             TEXT,
  sent_at             TEXT
);
