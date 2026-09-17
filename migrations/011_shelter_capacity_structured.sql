-- Split the free-text "shelter capacity" answer into a structured yes/no
-- plus a numeric estimate, so the number can be aggregated/reported on
-- instead of parsed out of prose. The old shelter_capacity column is left
-- in place (unused going forward, read/write removed from the API) so no
-- previously-collected free-text answers are discarded.
ALTER TABLE church_disaster_preparedness ADD COLUMN shelter_available      INTEGER;
ALTER TABLE church_disaster_preparedness ADD COLUMN shelter_capacity_count INTEGER;
ALTER TABLE church_disaster_preparedness ADD COLUMN shelter_notes         TEXT;
