-- migrate:up
-- target_days was dead plumbing: written and round-tripped by the API, read by
-- nothing -- no day-of-week filtering, no "due today" logic (habitcraft-uqu).
-- Verified empty in production before dropping: of 39 habits, 0 carried any
-- target days. See the habitcraft-uqu comment for the audit query.
ALTER TABLE habits DROP COLUMN IF EXISTS target_days;

-- migrate:down
-- Forward-only migration strategy
-- See db/README.md for rationale
