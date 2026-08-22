# Database Migrations

HabitCraft uses [dbmate](https://github.com/amacneil/dbmate) for database migrations. dbmate is language-agnostic and uses pure SQL migration files.

## Quick Reference

```bash
# Create a new migration
dbmate new add_email_reminders

# Run all pending migrations
dbmate up

# Check migration status
dbmate status

# Roll back last migration (if down migration exists)
dbmate down
```

## Local Development

Migrations run automatically when you start the development environment:

```bash
docker compose up -d
```

The `db-migrate` service runs before backends start, ensuring the schema is always up to date.

### Loading Seed Data

Seed data (test users, sample habits) is loaded separately to avoid duplicates on restarts:

```bash
# Load seed data once after initial setup
docker compose --profile seed run --rm db-seed
```

For manual migration runs (e.g., non-Docker workflow):

```bash
# Set database URL
export DATABASE_URL="postgresql://habituser:habitpass@localhost:5432/habitcraft?sslmode=disable"

# Run migrations
dbmate up
```

## Creating Migrations

1. Create a new migration file:
   ```bash
   dbmate new add_feature_name
   ```

2. Edit the generated file in `db/migrations/`:
   ```sql
   -- migrate:up
   ALTER TABLE users ADD COLUMN feature_flag BOOLEAN DEFAULT FALSE;

   -- migrate:down
   -- Forward-only: rollbacks handled by deploying a new migration
   ```

3. Test locally:
   ```bash
   docker compose down -v && docker compose up -d
   ```

4. Regenerate the committed schema dump and commit it alongside the migration:
   ```bash
   ./scripts/schema-dump.sh
   ```
   CI fails if you skip this -- see [The Generated Schema Dump](#the-generated-schema-dump-dbschemasql).

## Migration Strategy

### Forward-Only

We use a forward-only migration strategy:
- **No rollbacks in production** - rollbacks with real data are risky and rarely tested
- **Fix forward** - if something breaks, deploy a new migration to fix it
- The `-- migrate:down` section exists but contains only a comment

### Why Forward-Only?

1. **Simpler** - no need to maintain and test rollback logic
2. **Safer** - rollbacks can cause data loss or corruption
3. **Realistic** - in practice, teams almost never rollback; they fix forward
4. **Less code** - fewer lines to maintain and review

### Baseline Migration

The first migration (`20260117000000_baseline.sql`) contains the full initial schema. For existing production databases, this migration is marked as "already applied" in the `schema_migrations` table.

### Pre-Deployment Checklist

Before merging any migration to `master`:

- [ ] **Migration tested locally**: `docker compose down -v && docker compose up -d`
- [ ] **Migration reviewed**: Another team member has reviewed the SQL
- [ ] **Backup verified**: Confirm automated backups are enabled (CI creates one before each migration)
- [ ] **Rollback plan documented**: Know how you'll fix forward if something goes wrong

For high-risk migrations (data changes, column drops):

- [ ] **Tested with production-like data volume**
- [ ] **Dry-run on clone**: Test against a cloned instance first
- [ ] **Communication sent**: Notify team of planned migration window

## The Generated Schema Dump (`db/schema.sql`)

`db/migrations/` is the only thing that is ever executed. `db/schema.sql` is a
`pg_dump` of what those migrations add up to, committed so that schema changes
show up as a readable diff in review. **Nothing runs it, and nothing should
edit it by hand.**

It is trustworthy only because it is re-derived and compared, never because it
is asserted to be correct:

```bash
./scripts/schema-dump.sh          # regenerate after adding a migration
./scripts/schema-dump.sh --check  # fail if it no longer matches migrations/
```

`--check` runs in two places, so a migration committed without a regenerated
dump cannot reach `master` quietly:

- the `verify-schema-dump` job in `.github/workflows/ci.yml`
- the "Generated Schema Check" phase of `scripts/test-all.sh`

The dump is produced in a **throwaway** postgres container, not against the dev
or test database, so it cannot pick up hand-applied local changes and needs
nothing else to be running. Both images are **pinned by digest** inside
`scripts/schema-dump.sh`: `pg_dump` output shifts with both the client and the
server version, so a moving tag would eventually turn CI red without any schema
change at all. Bump both digests in one commit and regenerate. The two
`-- Dumped ... version` header comments are stripped for the same reason.

This replaced three unverified copies of the schema (`backend/schema.sql`,
`shared/database/schema.sql`, `shared/database/migrations/`), which had already
drifted apart from each other before anyone noticed -- see habitcraft-by9.

## CI/CD Pipeline

1. **Schema drift**: `verify-schema-dump` regenerates `schema.sql` and fails on any diff
2. **Integration tests**: Migrations run via dbmate before tests
3. **Production deploy**: Cloud Run Job executes migrations before service deployments
4. **Sequencing**: migrate → deploy backend → deploy frontend

## Files

```
db/
├── migrations/           # Migration SQL files -- THE SOURCE OF TRUTH
│   └── 20260117000000_baseline.sql
├── schema.sql            # Generated from migrations/; never edited by hand
├── Dockerfile            # Migration container for Cloud Run Job
├── entrypoint.sh         # Builds DATABASE_URL from component env vars
└── README.md             # This file

.dbmaterc                 # dbmate configuration
scripts/schema-dump.sh    # Regenerates and verifies schema.sql
```

## Production

### Cloud Run Job

Migrations run as a Cloud Run Job (`habitcraft-migrations`) before service deployments:

```bash
gcloud run jobs execute habitcraft-migrations --region us-central1 --wait
```

### CI/CD Safety Features

The CI/CD pipeline includes these safety checks:

1. **Pre-migration backup** - Cloud SQL backup created before every migration
2. **Status check** - Shows pending migrations before applying
3. **Post-migration verification** - Confirms job completed successfully
4. **Sequential deployment** - Backend/frontend only deploy after migrations succeed

### First Production Deployment Checklist

**Before first deployment with the new migration system:**

- [ ] **1. Verify Terraform is applied**
  ```bash
  cd infrastructure/terraform/gcp/prod
  terraform plan  # Should show no changes for migrations.tf resources
  ```

- [ ] **2. Mark baseline as applied in production DB**

  Connect to Cloud SQL and run:
  ```sql
  -- Check current state
  SELECT * FROM information_schema.tables WHERE table_name = 'schema_migrations';

  -- If table doesn't exist, create it and mark baseline
  CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(128) PRIMARY KEY);
  INSERT INTO schema_migrations (version) VALUES ('20260117000000');

  -- Verify
  SELECT * FROM schema_migrations;
  ```

- [ ] **3. Verify Cloud Run Job can connect**
  ```bash
  # Manually trigger job and watch logs
  gcloud run jobs execute habitcraft-migrations --region us-central1
  gcloud run jobs executions list --job=habitcraft-migrations --region=us-central1
  ```

- [ ] **4. Verify schema matches baseline**
  ```sql
  -- These tables should exist
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;

  -- Expected: completions, habits, refresh_tokens, schema_migrations, users
  ```

- [ ] **5. Create manual backup**
  ```bash
  gcloud sql backups create --instance=habitcraft-db --description="Pre-migration-system backup"
  ```

- [ ] **6. Test migration job (dry run)**
  ```bash
  # Job should report "Applied: 0, Pending: 0" since baseline is marked
  gcloud run jobs execute habitcraft-migrations --region us-central1 --wait
  gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=habitcraft-migrations" --limit=50
  ```

### Recovery Time & Data Loss Expectations

Based on tested restore procedures (January 2026):

| Metric | Value | Notes |
|--------|-------|-------|
| **RTO (Recovery Time Objective)** | 15-40 minutes | Depends on whether instance exists |
| **RPO (Recovery Point Objective)** | Seconds to 24 hours | Depends on backup type used |

**RTO Breakdown:**
- Restore to existing instance: ~15 minutes
- Create new instance + restore: ~35 minutes
- Add ~5 minutes for verification and DNS propagation

**RPO Options:**
- **Pre-migration backup**: Seconds before migration (best for migration failures)
- **Point-in-time recovery**: Any moment in the last 7 days
- **Daily automated backup**: Up to 24 hours of data loss

### Incident Runbook: Migration Broke Production

**Severity Assessment:**

| Symptom | Severity | Action |
|---------|----------|--------|
| Migration failed, no data changes | Low | Fix forward |
| Migration partial, schema inconsistent | Medium | Assess, likely fix forward |
| Data corruption or loss | High | Restore from backup |

**Step 1: Assess the Situation**

```bash
# Check migration job logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=habitcraft-migrations" --limit=100

# Check what migrations were applied
gcloud sql connect habitcraft-db --database=habitcraft --user=habitcraft
SELECT * FROM schema_migrations ORDER BY version;

# Check for obvious data issues
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM habits;
```

**Step 2: Decide - Fix Forward or Restore**

| Scenario | Recommendation |
|----------|----------------|
| Schema change failed cleanly | Fix the SQL, push new commit |
| Partial schema change | Write corrective migration, fix forward |
| Data was modified incorrectly | **Restore from backup** |
| Data was deleted | **Restore from backup** |

**Step 3a: Fix Forward (Preferred)**

1. Identify the issue in the migration SQL
2. Write a corrective migration:
   ```bash
   dbmate new fix_previous_migration
   ```
3. Test locally: `docker compose down -v && docker compose up -d`
4. Push and let CI/CD deploy

**Step 3b: Restore from Backup**

```bash
# 1. List available backups
gcloud sql backups list --instance=habitcraft-db

# 2. Find the pre-migration backup (look for timestamp just before incident)
#    Automated backups: daily at 03:00 UTC
#    Pre-migration backups: created by CI before each migration

# 3. Restore (THIS WILL OVERWRITE CURRENT DATA)
gcloud sql backups restore BACKUP_ID --restore-instance=habitcraft-db

# 4. Wait for restore to complete (~15 minutes)
gcloud sql operations list --instance=habitcraft-db --limit=1

# 5. Verify data integrity
gcloud sql connect habitcraft-db --database=habitcraft --user=habitcraft
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM habits;
SELECT * FROM schema_migrations;
```

**Step 4: Post-Incident**

1. Verify services are healthy
2. Check error rates in monitoring
3. Document what happened and why
4. Update migration to prevent recurrence

### Recovery Procedures

**If a migration fails (no data impact):**

1. Check Cloud Run Job logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=habitcraft-migrations" --limit=100
   ```

2. CI/CD will have stopped - backend/frontend won't deploy

3. Fix the migration SQL and push a new commit

**If data corruption occurred:**

Restore from the pre-migration backup:
```bash
# List backups and find the one created just before the migration
gcloud sql backups list --instance=habitcraft-db

# Restore to production (takes ~15 minutes)
gcloud sql backups restore BACKUP_ID --restore-instance=habitcraft-db

# Monitor the operation
watch -n 10 'gcloud sql operations list --instance=habitcraft-db --limit=1'
```

**If you need to skip a migration:**

Only do this if you've manually applied the changes:
```sql
-- Mark migration as applied without running it
INSERT INTO schema_migrations (version) VALUES ('YYYYMMDDHHMMSS');
```

## Troubleshooting

### Migration fails locally

```bash
# Reset everything and start fresh
docker compose down -v
docker compose up -d
```

### Check migration status

```bash
DATABASE_URL="postgresql://habituser:habitpass@localhost:5432/habitcraft?sslmode=disable" dbmate status
```

### View applied migrations

```sql
SELECT * FROM schema_migrations ORDER BY version;
```
