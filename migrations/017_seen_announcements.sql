-- Single, DB-backed record of which one-time overlays (first-login welcome
-- tour, "what's new" feature call-outs, etc.) each user has already seen.
-- Replaces the old localStorage-only dismissal flag, which was per-device
-- and couldn't reach existing users when new content was added — this
-- reaches everyone, on any device, and covers every future announcement
-- through the same mechanism (just add a new announcement_id).
CREATE TABLE IF NOT EXISTS seen_announcements (
  email           TEXT NOT NULL,
  announcement_id TEXT NOT NULL,
  seen_at         TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (email, announcement_id)
);
