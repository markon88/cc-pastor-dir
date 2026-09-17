-- Supports a shared call-queue for coordinators working through the
-- "still needs checking" roster: a claims table so multiple people signed
-- in at once each get handed a different pastor to call instead of
-- duplicating effort, and an append-only contact log recording every
-- attempt (outcome, note, who, when) regardless of whether it resolved
-- anything.
CREATE TABLE IF NOT EXISTS pastor_disaster_claims (
  incident_id  TEXT NOT NULL,
  pastor_id    TEXT NOT NULL,
  claimed_by   TEXT NOT NULL,
  claimed_at   TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (incident_id, pastor_id)
);

CREATE TABLE IF NOT EXISTS pastor_disaster_contact_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id  TEXT NOT NULL,
  pastor_id    TEXT NOT NULL,
  outcome      TEXT NOT NULL,
  note         TEXT,
  logged_by    TEXT NOT NULL,
  logged_at    TEXT DEFAULT (datetime('now'))
);
