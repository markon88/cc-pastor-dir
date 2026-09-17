-- Add a family-status question and change property damage from a plain
-- checkbox to a tri-state yes/no/unknown answer, so "not yet assessed" is
-- distinguishable from "no damage" (needed for the one-time post-login
-- self-report prompt, which must not silently record "no damage" for
-- someone who hasn't actually assessed anything yet).
-- The existing property_damage_residence/property_damage_church booleans
-- are kept in sync (1 only when the new status is 'yes') so the admin
-- dashboard, contact-list generator, and notification email — which all
-- read those columns — need no changes.
ALTER TABLE pastor_disaster_status ADD COLUMN family_status TEXT;
ALTER TABLE pastor_disaster_status ADD COLUMN property_damage_residence_status TEXT;
ALTER TABLE pastor_disaster_status ADD COLUMN property_damage_church_status TEXT;
