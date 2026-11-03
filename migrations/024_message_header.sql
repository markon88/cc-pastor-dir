-- Editable banner text at the top of a message (defaults to the sender's
-- name when blank).
ALTER TABLE message_campaigns ADD COLUMN header TEXT;
