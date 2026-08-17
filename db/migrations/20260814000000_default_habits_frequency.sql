-- migrate:up
-- Expand step for removing the frequency concept (habitcraft-00u). frequency
-- is NOT NULL with no default, so code that stops sending it cannot INSERT
-- until a default exists. Old revisions still send explicit values, which
-- satisfy the CHECK and ignore the default, so this is safe to apply while
-- they serve. The column is dropped in a follow-up migration once no running
-- code references it.
ALTER TABLE habits ALTER COLUMN frequency SET DEFAULT 'daily';

-- migrate:down
-- Forward-only migration strategy
-- See db/README.md for rationale
