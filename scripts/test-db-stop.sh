#!/bin/bash
# Stop the test database container
# Usage: ./scripts/test-db-stop.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Stopping test database..."

docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" down postgres-test

echo "Test database stopped."
