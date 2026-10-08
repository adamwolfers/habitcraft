#!/bin/bash

# Recreate BOTH local databases from db/migrations/ and confirm each one
# reached the newest migration. This is the "test a new migration locally"
# step in CLAUDE.md and db/README.md.
#
# Usage: ./scripts/db-recreate.sh
#
# There are two compose projects, and each runs dbmate against its own volume:
#
#   docker-compose.yml       habitcraft-db       :5432  dev
#   docker-compose.test.yml  habitcraft-db-test  :5433  integration tests
#
# The documented step used to be `docker compose down -v && docker compose up
# -d`, which touches only the first. The test database kept its old schema, so
# `npm run test:integration` ran against a database without the migration
# under test (habitcraft-nld). One script recreates both so the two halves
# cannot drift apart again.
#
# DESTRUCTIVE: wipes the dev and test database volumes.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV=(docker compose -f "$PROJECT_ROOT/docker-compose.yml")
TEST=(docker compose -f "$PROJECT_ROOT/docker-compose.test.yml")

if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running."
    exit 1
fi

# The version dbmate records for the newest file in db/migrations/.
EXPECTED=$(find "$PROJECT_ROOT/db/migrations" -name '*.sql' -exec basename {} \; \
    | sort | tail -1 | cut -d_ -f1)

# Running each migrate service in the foreground, rather than letting `up -d`
# start it, makes a failing migration stop this script with dbmate's error.
echo "Recreating the dev database (docker-compose.yml)..."
"${DEV[@]}" down -v
"${DEV[@]}" up -d postgres
"${DEV[@]}" run --rm db-migrate
"${DEV[@]}" up -d

# db-migrate-test also loads shared/database/test-fixtures.sql, which the
# integration suite expects.
echo "Recreating the test database (docker-compose.test.yml)..."
"${TEST[@]}" down -v
"${TEST[@]}" up -d postgres-test
"${TEST[@]}" run --rm db-migrate-test

# applied_version <compose file> <service> <database>
applied_version() {
    docker compose -f "$PROJECT_ROOT/$1" exec -T "$2" psql -U habituser -d "$3" -tA \
        -c 'SELECT max(version) FROM schema_migrations'
}

FAILED=0
check() {
    local label="$1" actual="$2"
    if [ "$actual" = "$EXPECTED" ]; then
        echo "✅ $label is at $EXPECTED"
    else
        echo "❌ $label is at '${actual:-nothing}', expected $EXPECTED"
        FAILED=1
    fi
}

check "dev database " "$(applied_version docker-compose.yml postgres habitcraft)"
check "test database" "$(applied_version docker-compose.test.yml postgres-test habitcraft_test)"
exit "$FAILED"
