-- Align church AMA assignments with the conference's official church → AMA
-- list (data/church AMAs.csv, received 2026-09-30). The 016 backfill copied
-- each church's AMA from its pastor's old pastor-based group, so these eight
-- inherited their pastor's AMA rather than the church's own. Pastors who
-- still participate in their old AMA can pick it via their personal AMA
-- preference (see 021_pastor_ama_preferences.sql).
UPDATE church_ama_groups SET group_id = 'central-piedmont' WHERE church_org_code IN (
  'ANT8EK', -- Asheville Evergreen Korean Company  (was blue-ridge)
  'ANT8C1', -- Banner Elk SDA Church                (was blue-ridge)
  'ANT8BO', -- Boone New Life SDA Church            (was blue-ridge)
  'ANT8M3', -- Charlotte Myanmar International      (was north-central)
  'ANT832', -- Mizo SDA Company                     (was north-central)
  'ANT8MQ'  -- Monroe Spanish SDA Church            (was eastern-carolina)
);
UPDATE church_ama_groups SET group_id = 'palmetto'      WHERE church_org_code = 'ANT8E6'; -- Columbia Korean (was central-piedmont)
UPDATE church_ama_groups SET group_id = 'north-central' WHERE church_org_code = 'ANT8GS'; -- Greensboro Korean (was eastern-carolina)
