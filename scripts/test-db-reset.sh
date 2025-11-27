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

# Drop and recreate all tables
echo "Dropping existing tables..."
docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" exec -T postgres-test psql -U habituser -d habitcraft_test << 'EOF'
-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS completions CASCADE;
DROP TABLE IF EXISTS habits CASCADE;
DROP TABLE IF EXISTS users CASCADE;
EOF

# Recreate schema
echo "Recreating schema..."
docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" exec -T postgres-test psql -U habituser -d habitcraft_test -f /docker-entrypoint-initdb.d/01-schema.sql

# Load test fixtures
echo "Loading test fixtures..."
docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" exec -T postgres-test psql -U habituser -d habitcraft_test -f /docker-entrypoint-initdb.d/02-test-fixtures.sql

echo "Test database reset complete!"
