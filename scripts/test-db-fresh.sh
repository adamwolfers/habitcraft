#!/bin/bash
# Start a completely fresh test database (removes all data)
# Usage: ./scripts/test-db-fresh.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Creating fresh test database..."

# Stop and remove existing test database container and volume
docker compose -f "$PROJECT_ROOT/docker-compose.test.yml" down -v postgres-test 2>/dev/null || true

# Start fresh
"$SCRIPT_DIR/test-db-start.sh"

echo "Fresh test database is ready!"
echo ""
echo "Test credentials:"
echo "  User 1: test@example.com / Test1234!"
echo "  User 2: test2@example.com / Test1234!"
echo ""
echo "Database connection:"
echo "  Host: localhost"
echo "  Port: 5433"
echo "  Database: habitcraft_test"
echo "  User: habituser"
echo "  Password: habitpass"
