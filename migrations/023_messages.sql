-- Messages module: role-gated bulk email (Resend Broadcasts) to pastors plus
-- uploaded contact lists (teachers, ACS directors, ...). Built for the
-- conference ACS director, whose office maintains the lists.

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
