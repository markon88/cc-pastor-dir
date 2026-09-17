-- Structured versions of the communication-plan and coordinator questions,
-- replacing single free-text fields (previously communication_plan,
-- donation_dropoff_coordinator, distribution_point_coordinator) with a
-- yes/no + checkbox set for communication methods, and separate
-- name/phone/email columns for each coordinator. The old free-text columns
-- are left in place (unused going forward) so no previously-collected
-- answers are discarded.
ALTER TABLE church_disaster_preparedness ADD COLUMN has_communication_plan   INTEGER;
ALTER TABLE church_disaster_preparedness ADD COLUMN comm_method_phone_tree   INTEGER;
ALTER TABLE church_disaster_preparedness ADD COLUMN comm_method_group_text   INTEGER;
ALTER TABLE church_disaster_preparedness ADD COLUMN comm_method_app         INTEGER;
ALTER TABLE church_disaster_preparedness ADD COLUMN comm_method_other        INTEGER;
ALTER TABLE church_disaster_preparedness ADD COLUMN comm_method_other_detail TEXT;

ALTER TABLE church_disaster_preparedness ADD COLUMN donation_dropoff_coordinator_name  TEXT;
ALTER TABLE church_disaster_preparedness ADD COLUMN donation_dropoff_coordinator_phone TEXT;
ALTER TABLE church_disaster_preparedness ADD COLUMN donation_dropoff_coordinator_email TEXT;

ALTER TABLE church_disaster_preparedness ADD COLUMN distribution_point_coordinator_name  TEXT;
ALTER TABLE church_disaster_preparedness ADD COLUMN distribution_point_coordinator_phone TEXT;
ALTER TABLE church_disaster_preparedness ADD COLUMN distribution_point_coordinator_email TEXT;
