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

# Database URL for test environment
DATABASE_URL="postgresql://habituser:habitpass@localhost:5433/habitcraft_test?sslmode=disable"

# Drop and recreate database using dbmate
echo "Dropping and recreating database..."
DATABASE_URL="$DATABASE_URL" dbmate drop || true  # Ignore error if DB doesn't exist
DATABASE_URL="$DATABASE_URL" dbmate up

# Load test fixtures
echo "Loading test fixtures..."
PGPASSWORD=habitpass psql -h localhost -p 5433 -U habituser -d habitcraft_test -f "$PROJECT_ROOT/shared/database/test-fixtures.sql"

echo "Test database reset complete!"
