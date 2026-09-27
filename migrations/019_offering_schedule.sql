-- Conference offering schedule — one row per Sabbath, printed alongside
-- Friday/Sabbath sundown times on the per-church Sundown Calendar PDF (see
-- public/js/sundown.js). Entered once per year by an admin from the Admin
-- tab when the conference publishes the next year's plan; every church's
-- calendar reads from this one table.
CREATE TABLE IF NOT EXISTS offering_schedule (
  sabbath_date TEXT PRIMARY KEY,  -- YYYY-MM-DD, always a Saturday
  offering     TEXT NOT NULL,
  updated_by   TEXT,
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- 2026 plan, as printed on Florence First's 2026 offering schedule.
INSERT OR IGNORE INTO offering_schedule (sabbath_date, offering) VALUES
  ('2026-01-03', 'Local Church Budget'),
  ('2026-01-10', 'Religious Liberty'),
  ('2026-01-17', 'Local Church Budget'),
  ('2026-01-24', 'Carolina Youth'),
  ('2026-01-31', 'Local Church Budget'),
  ('2026-02-07', 'Local Church Budget'),
  ('2026-02-14', 'SDA TV Evangelism'),
  ('2026-02-21', 'Local Church Budget'),
  ('2026-02-28', 'Carolina Youth'),
  ('2026-03-07', 'Local Church Budget'),
  ('2026-03-14', 'Adventist World Radio'),
  ('2026-03-21', 'Local Church Budget'),
  ('2026-03-28', 'Carolina Youth'),
  ('2026-04-04', 'Local Church Budget'),
  ('2026-04-11', 'Hope Channel'),
  ('2026-04-18', 'Local Church Budget'),
  ('2026-04-25', 'Carolina Youth'),
  ('2026-05-02', 'Local Church Budget'),
  ('2026-05-09', 'Disaster & Famine Relief'),
  ('2026-05-16', 'Local Church Budget'),
  ('2026-05-23', 'Carolina Youth'),
  ('2026-05-30', 'Local Church Budget'),
  ('2026-06-06', 'Local Church Budget'),
  ('2026-06-13', 'Women''s Ministries'),
  ('2026-06-20', 'Local Church Budget'),
  ('2026-06-27', 'Carolina Youth'),
  ('2026-07-04', 'Local Church Budget'),
  ('2026-07-11', 'Mount Pisgah Academy'),
  ('2026-07-18', 'Local Church Budget'),
  ('2026-07-25', 'Carolina Youth'),
  ('2026-08-01', 'Local Church Budget'),
  ('2026-08-08', 'Christian Record Services'),
  ('2026-08-15', 'Local Church Budget'),
  ('2026-08-22', 'Carolina Youth'),
  ('2026-08-29', 'Local Church Budget'),
  ('2026-09-05', 'Local Church Budget'),
  ('2026-09-12', 'Radio Ministries'),
  ('2026-09-19', 'Local Church Budget'),
  ('2026-09-26', 'Carolina Youth'),
  ('2026-10-03', 'Local Church Budget'),
  ('2026-10-10', 'Carolina Youth'),
  ('2026-10-17', 'Local Church Budget'),
  ('2026-10-24', 'Mount Pisgah Academy'),
  ('2026-10-31', 'Carolina Youth'),
  ('2026-11-07', 'Local Church Budget'),
  ('2026-11-14', 'Global Mission'),
  ('2026-11-21', 'Local Church Budget'),
  ('2026-11-28', 'Carolina Youth'),
  ('2026-12-05', 'Local Church Budget'),
  ('2026-12-12', 'Adventist Community Services'),
  ('2026-12-19', 'Local Church Budget'),
  ('2026-12-26', 'Carolina Evangelism');
