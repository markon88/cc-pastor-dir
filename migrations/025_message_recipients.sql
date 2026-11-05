-- Follow-ups for Messages: remember who each message went to and who has
-- responded. Replies go straight to the sender's own inbox, so a response is
-- recorded by the recipient tapping their personal "Yes, I got this" link
-- (token) or by the sender ticking them off by hand.
CREATE TABLE IF NOT EXISTS message_recipients (
  campaign_id   INTEGER NOT NULL,
  email         TEXT NOT NULL,      -- lowercased
  first_name    TEXT,
  last_name     TEXT,
  organization  TEXT,
  token         TEXT NOT NULL UNIQUE,
  responded_at  TEXT,
  responded_via TEXT,               -- 'button' | 'manual'
  marked_by     TEXT,               -- who ticked them off, for 'manual'
  PRIMARY KEY (campaign_id, email)
);

-- A follow-up is a campaign whose recipients are the parent's non-responders.
-- It has no recipient rows of its own: its links record against the parent.
ALTER TABLE message_campaigns ADD COLUMN parent_campaign_id INTEGER;
ALTER TABLE message_campaigns ADD COLUMN followup_number INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_campaigns_followup
  ON message_campaigns(parent_campaign_id, followup_number) WHERE parent_campaign_id IS NOT NULL;

-- Optional nudge to the sender, N days after sending (0 = none). Sent by the
-- daily cron; see functions/api/cron/message-reminders.js.
ALTER TABLE message_campaigns ADD COLUMN remind_after_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE message_campaigns ADD COLUMN reminded_at TEXT;
