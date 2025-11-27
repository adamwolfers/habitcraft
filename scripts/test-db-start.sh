#!/bin/bash
# Start the test database container
# Usage: ./scripts/test-db-start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Starting test database..."

# Start only the postgres-test service
docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" up -d postgres-test

# Wait for database to be healthy
echo "Waiting for test database to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" exec -T postgres-test pg_isready -U habituser -d habitcraft_test > /dev/null 2>&1; then
        echo "Test database is ready!"
        exit 0
    fi
    attempt=$((attempt + 1))
    echo "Waiting... (attempt $attempt/$max_attempts)"
    sleep 1
done

echo "Error: Test database failed to start within $max_attempts seconds"
exit 1
