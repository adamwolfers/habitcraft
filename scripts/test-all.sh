#!/bin/bash

# Run all tests sequentially
# Usage: ./scripts/test-all.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

# Check if services are already running
if curl -s http://localhost:3010/health > /dev/null 2>&1; then
    echo "✅ Test services already running"
    echo "   (To force rebuild, run: docker compose -f docker-compose.test.yml down)"
else
    echo "Stopping any existing test containers..."
    docker compose -f docker-compose.test.yml down 2>/dev/null || true
    echo "Removing old test images..."
    docker rmi habittracker_fullstack-backend-node-test habittracker_fullstack-frontend-nextjs-test 2>/dev/null || true
    echo "Removing node_modules volumes (ensures fresh dependencies)..."
    docker volume rm habittracker_fullstack_backend_node_test_modules 2>/dev/null || true
    echo "Building Docker containers (--no-cache for fresh dependencies)..."
    docker compose -f docker-compose.test.yml build --no-cache
    echo "Starting Docker containers..."
    docker compose -f docker-compose.test.yml up -d

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
fi
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
    echo "🎉 All tests passed!"
    exit 0
else
    echo "💥 Some tests failed"
    exit 1
fi
