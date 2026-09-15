-- Additional congregation fields available from eAdventist that weren't
-- previously captured: contact info, service times, mailing address,
-- language, and lat/long (used to derive county via reverse geocoding
-- instead of an address lookup).
ALTER TABLE churches ADD COLUMN website             TEXT;
ALTER TABLE churches ADD COLUMN phone               TEXT;
ALTER TABLE churches ADD COLUMN email               TEXT;
ALTER TABLE churches ADD COLUMN language            TEXT;
ALTER TABLE churches ADD COLUMN latitude            REAL;
ALTER TABLE churches ADD COLUMN longitude           REAL;
ALTER TABLE churches ADD COLUMN is_active           TEXT;
ALTER TABLE churches ADD COLUMN is_public           TEXT;
ALTER TABLE churches ADD COLUMN driving_directions  TEXT;
ALTER TABLE churches ADD COLUMN service_times       TEXT; -- JSON: {sabbath_school, church, church_2, streaming_time, prayer_meeting}
ALTER TABLE churches ADD COLUMN mail_street         TEXT;
ALTER TABLE churches ADD COLUMN mail_city           TEXT;
ALTER TABLE churches ADD COLUMN mail_state          TEXT;
ALTER TABLE churches ADD COLUMN mail_zip            TEXT;
