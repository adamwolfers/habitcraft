-- migrate:up
ALTER TABLE habits ALTER COLUMN description TYPE VARCHAR(500);

-- migrate:down
-- Forward-only migration strategy
-- See db/README.md for rationale
