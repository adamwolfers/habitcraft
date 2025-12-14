#!/bin/bash

# Run all tests sequentially
# Usage: ./scripts/test-all.sh [options]
#
# Options:
#   -r, --rebuild    Force full rebuild of containers (removes volumes, builds with --no-cache)
#                    Use this when dependencies have changed or you're experiencing stale issues
#   -h, --help       Show this help message
#
# By default, the script uses cached containers for faster startup (~30s vs ~3min).
# Dependencies are auto-detected: if package-lock.json files have changed since the
# last successful run, containers will be rebuilt automatically.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_HASH_FILE="$PROJECT_ROOT/.test-deps-hash"

# Parse arguments
FORCE_REBUILD=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -r|--rebuild) FORCE_REBUILD=true ;;
        -h|--help)
            echo "Usage: ./scripts/test-all.sh [options]"
            echo ""
            echo "Options:"
            echo "  -r, --rebuild    Force full rebuild of containers"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

echo "=============================================="
echo "Running All Tests"
echo "=============================================="
echo ""

# Track results
BACKEND_UNIT=0
FRONTEND_UNIT=0
INTEGRATION=0
E2E=0

# Helper function to wait for a service
wait_for_service() {
    local url=$1
    local name=$2
    local retries=${3:-30}

    until curl -s "$url" > /dev/null 2>&1; do
        retries=$((retries - 1))
        if [ $retries -le 0 ]; then
            echo "❌ Timeout waiting for $name"
            return 1
        fi
        echo "  Waiting for $name... ($retries retries left)"
        sleep 2
    done
    return 0
}

# Start all test services up front
echo "🐳 Starting test services..."
echo "----------------------------------------------"
cd "$PROJECT_ROOT"

# Check if dependencies have changed since last successful run
CURRENT_HASH=$(cat backends/node/package-lock.json frontends/nextjs/package-lock.json 2>/dev/null | md5 -q 2>/dev/null || cat backends/node/package-lock.json frontends/nextjs/package-lock.json | md5sum | cut -d' ' -f1)

if [ "$FORCE_REBUILD" = false ] && [ -f "$LOCK_HASH_FILE" ]; then
    SAVED_HASH=$(cat "$LOCK_HASH_FILE")
    if [ "$SAVED_HASH" != "$CURRENT_HASH" ]; then
        echo "⚠️  Dependencies changed since last run - triggering rebuild"
        FORCE_REBUILD=true
    fi
fi

if [ "$FORCE_REBUILD" = true ]; then
    echo "Force rebuild requested - removing old containers and volumes..."
    docker compose -f docker-compose.test.yml down -v 2>/dev/null || true
    echo "Removing old test images..."
    docker rmi habitcraft-backend-node-test habitcraft-frontend-nextjs-test 2>/dev/null || true
    echo "Building Docker containers (--no-cache for fresh dependencies)..."
    docker compose -f docker-compose.test.yml build --no-cache
    echo "Starting Docker containers..."
    docker compose -f docker-compose.test.yml up -d
else
    echo "Starting containers (use --rebuild for fresh build)..."
    docker compose -f docker-compose.test.yml up -d
fi

# Wait for database to be healthy first
echo "Waiting for database..."
RETRIES=30
until docker compose -f docker-compose.test.yml ps postgres-test 2>/dev/null | grep -q "healthy"; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        echo "❌ Timeout waiting for database"
        echo "Check logs: docker compose -f docker-compose.test.yml logs postgres-test"
        exit 1
    fi
    echo "  Waiting for database... ($RETRIES retries left)"
    sleep 2
done
echo "✅ Database is ready"

# Wait for backend
if ! wait_for_service "http://localhost:3010/health" "backend"; then
    echo "Check logs: docker compose -f docker-compose.test.yml logs backend-node-test"
    exit 1
fi
echo "✅ Backend is ready"

# Wait for frontend
if ! wait_for_service "http://localhost:3110" "frontend"; then
    echo "Check logs: docker compose -f docker-compose.test.yml logs frontend-nextjs-test"
    exit 1
fi
echo "✅ Frontend is ready"
echo ""

# 1. Backend Unit Tests
echo "📦 [1/4] Backend Unit Tests"
echo "----------------------------------------------"
cd "$PROJECT_ROOT/backends/node"
if npm test; then
    BACKEND_UNIT=1
    echo "✅ Backend unit tests passed"
else
    echo "❌ Backend unit tests failed"
fi
echo ""

# 2. Frontend Unit Tests
echo "🎨 [2/4] Frontend Unit Tests"
echo "----------------------------------------------"
cd "$PROJECT_ROOT/frontends/nextjs"
if npm test; then
    FRONTEND_UNIT=1
    echo "✅ Frontend unit tests passed"
else
    echo "❌ Frontend unit tests failed"
fi
echo ""

# 3. Backend Integration Tests
echo "🔗 [3/4] Backend Integration Tests"
echo "----------------------------------------------"
cd "$PROJECT_ROOT/backends/node"
if npm run test:integration; then
    INTEGRATION=1
    echo "✅ Integration tests passed"
else
    echo "❌ Integration tests failed"
fi
echo ""

# 4. E2E Tests
echo "🌐 [4/4] End-to-End Tests"
echo "----------------------------------------------"
cd "$PROJECT_ROOT/frontends/nextjs"
if npm run test:e2e; then
    E2E=1
    echo "✅ E2E tests passed"
else
    echo "❌ E2E tests failed"
fi
echo ""

# Summary
echo "=============================================="
echo "Test Summary"
echo "=============================================="
echo ""
[ $BACKEND_UNIT -eq 1 ] && echo "✅ Backend Unit Tests" || echo "❌ Backend Unit Tests"
[ $FRONTEND_UNIT -eq 1 ] && echo "✅ Frontend Unit Tests" || echo "❌ Frontend Unit Tests"
[ $INTEGRATION -eq 1 ] && echo "✅ Integration Tests" || echo "❌ Integration Tests"
[ $E2E -eq 1 ] && echo "✅ E2E Tests" || echo "❌ E2E Tests"
echo ""

# Note about services
echo "----------------------------------------------"
echo "Note: Test services are still running."
echo "To stop: docker compose -f docker-compose.test.yml down"
echo "----------------------------------------------"
echo ""

# Exit with error if any tests failed
TOTAL=$((BACKEND_UNIT + FRONTEND_UNIT + INTEGRATION + E2E))
if [ $TOTAL -eq 4 ]; then
    # Save dependency hash after successful run
    echo "$CURRENT_HASH" > "$LOCK_HASH_FILE"
    echo "🎉 All tests passed!"
    exit 0
else
    echo "💥 Some tests failed"
    exit 1
fi
