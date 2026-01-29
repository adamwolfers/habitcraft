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

# Terminate existing connections to allow drop
docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" exec -T postgres-test \
    psql -U habituser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'habitcraft_test' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true

docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" exec -T postgres-test \
    psql -U habituser -d postgres -c "DROP DATABASE IF EXISTS habitcraft_test"
docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" exec -T postgres-test \
    psql -U habituser -d postgres -c "CREATE DATABASE habitcraft_test"

# Run migrations and load fixtures via db-migrate-test service
echo "Running migrations and loading fixtures..."
docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" run --rm db-migrate-test

echo "Test database reset complete!"
