-- Optional note a pastor can add explaining their AMA choice. Included in the
-- coordinator's notification email and kept for the record; deliberately not
-- served in /api/data, which every directory user receives.
ALTER TABLE pastor_ama_preferences ADD COLUMN note TEXT;
