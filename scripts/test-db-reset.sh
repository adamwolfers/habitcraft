#!/bin/bash
# Reset the test database to a clean state with fixtures
# Usage: ./scripts/test-db-reset.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Resetting test database..."

# Check if test database is running
if ! docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" exec -T postgres-test pg_isready -U habituser -d habitcraft_test > /dev/null 2>&1; then
    echo "Error: Test database is not running. Start it first with ./scripts/test-db-start.sh"
    exit 1
fi

# Drop and recreate database via psql (must connect to 'postgres' db to drop 'habitcraft_test')
echo "Dropping and recreating database..."

# Drop atomically with WITH (FORCE), which terminates remaining sessions inside
# the same command. A separate pg_terminate_backend followed by a DROP in a later
# psql session left a ~1s window: backend-test's healthcheck hits /health, which
# runs SELECT 1 against habitcraft_test and parks that connection in the pool for
# 30s. One landing in the window made DROP fail with "is being accessed by other
# users", aborting the reset and failing every test in the calling file. See
# habitcraft-lb3.
#
# FORCE narrows the window but does not provably close it — PG14 still admits new
# connections to a database while it is being dropped — so retry a few times, and
# log each retry so a real regression stays visible.
drop_test_database() {
    docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" exec -T postgres-test \
        psql -U habituser -d postgres -c "DROP DATABASE IF EXISTS habitcraft_test WITH (FORCE)" 2>&1
}

DROP_MAX_ATTEMPTS=3
attempt=1
until drop_output="$(drop_test_database)"; do
    if [ "$attempt" -ge "$DROP_MAX_ATTEMPTS" ]; then
        echo "Error: DROP DATABASE failed after $DROP_MAX_ATTEMPTS attempts:" >&2
        echo "$drop_output" >&2
        exit 1
    fi
    echo "DROP DATABASE attempt $attempt/$DROP_MAX_ATTEMPTS failed, retrying in 1s:" >&2
    echo "$drop_output" >&2
    attempt=$((attempt + 1))
    sleep 1
done
docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" exec -T postgres-test \
    psql -U habituser -d postgres -c "CREATE DATABASE habitcraft_test"

# Run migrations and load fixtures via db-migrate-test service
echo "Running migrations and loading fixtures..."
docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" run --rm db-migrate-test

echo "Test database reset complete!"
