-- Bug reports, feature requests, and data-update requests submitted from the
-- profile menu's "Report an Issue" form. Mirrors the feedback tool already
-- built for the My People My Church app, scoped down for this app's size.
CREATE TABLE feedback_reports (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  type           TEXT NOT NULL,   -- 'bug' | 'feature' | 'data'
  message        TEXT NOT NULL,
  urgent         INTEGER DEFAULT 0,
  submitted_by   TEXT NOT NULL,   -- email
  submitted_name TEXT,
  page           TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);
