# Shared Database Fixtures

This directory holds **test-fixtures.sql**, the seed data shared by development,
CI, and the test environments. That is all it holds.

## Where the schema lives

`db/migrations/` is the source of truth for the database structure. It is what
dbmate executes, in every environment:

| Environment | What runs the migrations |
|---|---|
| dev | `db-migrate` service in `docker-compose.yml` |
| test | `db-migrate-test` service in `docker-compose.test.yml`, plus `dbmate up` in the `backend-integration-tests` CI job |
| prod | Cloud Run Job `habitcraft-migrations` |

To **read** the current schema, open `db/schema.sql`. It is a generated
`pg_dump` of what the migrations add up to, committed for reviewability;
`scripts/schema-dump.sh --check` regenerates it and CI fails on any diff, which
is the only reason it can be trusted. Never edit it by hand, and never run it —
see [db/README.md](../../db/README.md).

This directory used to carry its own `schema.sql` and a second `migrations/`
directory. Nothing executed either one, nothing verified them, and they had
already drifted from the real schema and from each other. Both were deleted in
habitcraft-by9. If you are here because a document sent you looking for
`shared/database/schema.sql`, `db/schema.sql` is what you want.

## test-fixtures.sql

Loaded on demand in development:

```bash
docker compose --profile seed run --rm db-seed
```

It creates:

- Test user 1 — id `11111111-1111-1111-1111-111111111111`, `test@example.com`, password `Test1234!`
- Test user 2 — id `22222222-2222-2222-2222-222222222222`, `test2@example.com`, password `Test1234!`
- Sample habits and completions for those users

The same file seeds the test database (`docker-compose.test.yml`) and the CI
integration job, so a fixture change lands everywhere at once. It assumes the
migrations have already been applied; it creates no tables.

## Environment Variables

All backends use these for the database connection:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=habitcraft
DB_USER=habituser
DB_PASSWORD=habitpass
DATABASE_URL=postgresql://habituser:habitpass@localhost:5432/habitcraft
```
