-- migrate:up
-- Contract step for removing the frequency concept (habitcraft-00u): every
-- habit is once-per-day, so the column is dead. Shipped separately after the
-- code stopped referencing it (see the expand migration 20260814000000).
-- Verified in production before dropping: of 39 habits, 0 were weekly.
-- Dropping the column also drops its CHECK constraint and default.
ALTER TABLE habits DROP COLUMN IF EXISTS frequency;

-- migrate:down
-- Forward-only migration strategy
-- See db/README.md for rationale
