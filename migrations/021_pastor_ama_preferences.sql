-- A pastor's personal choice of which AMA they participate in, overriding
-- the AMA(s) derived from the churches they serve (church_ama_groups) — for
-- pastors near an AMA boundary, living closer to another AMA, or serving
-- churches that span more than one. Keyed on the pastor, not the church, so
-- it never carries over to whoever pastors those churches next.
CREATE TABLE IF NOT EXISTS pastor_ama_preferences (
  pastor_id  TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
