ALTER TABLE pastors  ADD COLUMN photo_url TEXT;
ALTER TABLE churches ADD COLUMN photo_url TEXT;

CREATE TABLE IF NOT EXISTS disaster_incidents (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  active              INTEGER DEFAULT 1,
  coordination_emails TEXT,
  created_by          TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  closed_at           TEXT
);

CREATE TABLE IF NOT EXISTS church_disaster_status (
  incident_id           TEXT NOT NULL,
  church_name           TEXT NOT NULL,
  status                TEXT DEFAULT 'unknown',
  is_pod                INTEGER DEFAULT 0,
  pod_water             INTEGER DEFAULT 0,
  pod_toilet_paper      INTEGER DEFAULT 0,
  pod_paper_towels      INTEGER DEFAULT 0,
  pod_food              INTEGER DEFAULT 0,
  pod_cleaning_supplies INTEGER DEFAULT 0,
  pod_flood_buckets     INTEGER DEFAULT 0,
  is_donation_dropoff   INTEGER DEFAULT 0,
  is_transportation     INTEGER DEFAULT 0,
  notes                 TEXT,
  updated_by            TEXT,
  updated_at            TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (incident_id, church_name)
);

CREATE TABLE IF NOT EXISTS pastor_disaster_status (
  incident_id                TEXT NOT NULL,
  pastor_id                  TEXT NOT NULL,
  status                     TEXT DEFAULT 'unknown',
  note                       TEXT,
  property_damage_residence  INTEGER DEFAULT 0,
  property_damage_church     INTEGER DEFAULT 0,
  notify_coordination        INTEGER DEFAULT 0,
  confirmed_by               TEXT,
  updated_at                 TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (incident_id, pastor_id)
);

CREATE TABLE IF NOT EXISTS disaster_photos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id  TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id   TEXT NOT NULL,
  r2_key       TEXT NOT NULL,
  caption      TEXT,
  uploaded_by  TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS disaster_admins (
  incident_id TEXT NOT NULL,
  email       TEXT NOT NULL,
  granted_by  TEXT,
  granted_at  TEXT DEFAULT (datetime('now')),
  revoked_at  TEXT,
  PRIMARY KEY (incident_id, email)
);

-- Standing data, not incident-scoped: where a church's people are willing/able to respond
CREATE TABLE IF NOT EXISTS church_disaster_counties (
  church_name    TEXT NOT NULL,
  county         TEXT NOT NULL,
  mode           TEXT NOT NULL,
  response_hours TEXT,
  cert_count     INTEGER DEFAULT 0,
  updated_by     TEXT,
  updated_at     TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (church_name, county)
);
