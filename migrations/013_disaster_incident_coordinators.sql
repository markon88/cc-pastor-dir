-- Structured coordination-team roster per incident, replacing the old
-- free-text/comma-separated coordination_emails entry field. Each row is one
-- coordinator, either linked to an existing pastor (pastor_id set) or
-- entered manually (pastor_id null). disaster_incidents.coordination_emails
-- is still populated (derived from these rows' emails) so the existing
-- notify-coordination email pathway in functions/api/disaster/status.js
-- needs no changes.
CREATE TABLE IF NOT EXISTS disaster_incident_coordinators (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id TEXT NOT NULL,
  pastor_id   TEXT,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);
