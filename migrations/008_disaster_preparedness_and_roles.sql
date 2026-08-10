-- Standing (not incident-scoped) self-assessed preparedness, collected one
-- question at a time via a guided wizard. Every field nullable — a church
-- should never be forced to answer something it isn't ready to share.
CREATE TABLE IF NOT EXISTS church_disaster_preparedness (
  church_name                    TEXT PRIMARY KEY,
  backup_power                   INTEGER,
  backup_power_notes             TEXT,
  emergency_supplies             INTEGER,
  emergency_supplies_notes       TEXT,
  shelter_capacity               TEXT,
  communication_plan             TEXT,
  donation_dropoff               INTEGER,
  donation_dropoff_coordinator   TEXT,
  transportation_available       INTEGER,
  transportation_notes           TEXT,
  distribution_point             INTEGER,
  distribution_point_coordinator TEXT,
  emergency_contact_name         TEXT,
  emergency_contact_phone        TEXT,
  notes                          TEXT,
  updated_by                     TEXT,
  updated_at                     TEXT DEFAULT (datetime('now'))
);

-- Standing (permanent, not incident-scoped) disaster-module role. Full access
-- to everything disaster-related — start/close incidents, deputize
-- per-incident helpers, edit the coordinator contact, view/edit all
-- statuses — but nothing outside the disaster module. Grantable only by a
-- true ADMIN_EMAILS admin (see role-admins.js), same chain-granting
-- restriction as the existing per-incident disaster_admins table.
CREATE TABLE IF NOT EXISTS disaster_role_admins (
  email      TEXT PRIMARY KEY,
  granted_by TEXT,
  granted_at TEXT DEFAULT (datetime('now')),
  revoked_at TEXT
);

-- Small standing key/value config store. First use: the conference-wide
-- Disaster Response Coordinator contact (name/email/phone), admin-editable,
-- not hardcoded.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
