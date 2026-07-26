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

# Per-phase timeouts (seconds). A leaked handle in any phase must not be able
# to stall the whole suite indefinitely -- see habitcraft-doz, where one
# timed-out integration test left jest idling in its event loop forever and the
# run sat at 0% CPU until it was killed by hand 40+ minutes later.
TIMEOUT_BACKEND_UNIT=300
TIMEOUT_FRONTEND_UNIT=600
TIMEOUT_INTEGRATION=300
TIMEOUT_E2E_SHARD=900

# Run a command with a wall-clock limit, returning its exit code.
# macOS has no coreutils `timeout`, so this uses a background watchdog.
run_with_timeout() {
    local timeout_secs=$1
    shift

    # Job control makes the command its own process group leader, so killing
    # the group takes jest/playwright children with it rather than orphaning
    # them behind the npm wrapper.
    set -m
    "$@" &
    local cmd_pid=$!
    set +m

    (
        sleep "$timeout_secs"
        kill -9 -"$cmd_pid" 2>/dev/null || kill -9 "$cmd_pid" 2>/dev/null
    ) &
    local watchdog_pid=$!

    wait "$cmd_pid"
    local rc=$?

    # Cancel the watchdog if the command finished on its own
    kill "$watchdog_pid" 2>/dev/null
    wait "$watchdog_pid" 2>/dev/null

    if [ $rc -ge 128 ]; then
        echo "⏱️  TIMEOUT: phase exceeded ${timeout_secs}s and was killed (exit $rc)"
    fi
    return $rc
}

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
CURRENT_HASH=$(cat backend/package-lock.json frontend/package-lock.json 2>/dev/null | md5 -q 2>/dev/null || cat backend/package-lock.json frontend/package-lock.json | md5sum | cut -d' ' -f1)

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
    docker rmi habitcraft-backend-test habitcraft-frontend-test 2>/dev/null || true
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
    echo "Check logs: docker compose -f docker-compose.test.yml logs backend-test"
    exit 1
fi
echo "✅ Backend is ready"

# Wait for frontend
if ! wait_for_service "http://localhost:3110" "frontend"; then
    echo "Check logs: docker compose -f docker-compose.test.yml logs frontend-test"
    exit 1
fi
echo "✅ Frontend is ready"
echo ""

# 1. Backend Unit Tests
echo "📦 [1/4] Backend Unit Tests"
echo "----------------------------------------------"
cd "$PROJECT_ROOT/backend"
if run_with_timeout "$TIMEOUT_BACKEND_UNIT" npm test; then
    BACKEND_UNIT=1
    echo "✅ Backend unit tests passed"
else
    echo "❌ Backend unit tests failed"
fi
echo ""

# 2. Frontend Unit Tests
echo "🎨 [2/4] Frontend Unit Tests"
echo "----------------------------------------------"
cd "$PROJECT_ROOT/frontend"
if run_with_timeout "$TIMEOUT_FRONTEND_UNIT" npm test; then
    FRONTEND_UNIT=1
    echo "✅ Frontend unit tests passed"
else
    echo "❌ Frontend unit tests failed"
fi
echo ""

# 3. Backend Integration Tests
echo "🔗 [3/4] Backend Integration Tests"
echo "----------------------------------------------"
cd "$PROJECT_ROOT/backend"
if run_with_timeout "$TIMEOUT_INTEGRATION" npm run test:integration; then
    INTEGRATION=1
    echo "✅ Integration tests passed"
else
    echo "❌ Integration tests failed"
fi
echo ""

# 4. E2E Tests (parallel shards)
echo "🌐 [4/4] End-to-End Tests (4 parallel shards)"
echo "----------------------------------------------"
cd "$PROJECT_ROOT/frontend"

# Reset database once before running shards
echo "  Resetting test database..."
"$PROJECT_ROOT/scripts/test-db-reset.sh" > /dev/null 2>&1

# Create temp directory for shard logs
E2E_LOG_DIR="$PROJECT_ROOT/frontend/.e2e-shard-logs"
mkdir -p "$E2E_LOG_DIR"

# Disable set -e for parallel section (exit codes handled manually)
set +e

# Run 4 shards in parallel with SKIP_E2E_SETUP to avoid duplicate DB resets
# Using individual variables for compatibility with older bash (macOS /bin/bash is 3.x)
SKIP_E2E_SETUP=1 npx playwright test --shard=1/4 > "$E2E_LOG_DIR/shard-1.log" 2>&1 &
PID1=$!
echo "  Started shard 1/4 (PID $PID1)"

SKIP_E2E_SETUP=1 npx playwright test --shard=2/4 > "$E2E_LOG_DIR/shard-2.log" 2>&1 &
PID2=$!
echo "  Started shard 2/4 (PID $PID2)"

SKIP_E2E_SETUP=1 npx playwright test --shard=3/4 > "$E2E_LOG_DIR/shard-3.log" 2>&1 &
PID3=$!
echo "  Started shard 3/4 (PID $PID3)"

SKIP_E2E_SETUP=1 npx playwright test --shard=4/4 > "$E2E_LOG_DIR/shard-4.log" 2>&1 &
PID4=$!
echo "  Started shard 4/4 (PID $PID4)"

# One watchdog per shard. Playwright has its own per-test timeouts, but those
# do not cover a shard that wedges outside a test (or after the run finishes),
# which would leave the `wait` below blocking forever.
# Note: unlike run_with_timeout, these shards are not in their own process
# group, so only the shard PID is killed -- killing the group would take this
# script with it.
for shard in 1 2 3 4; do
    eval "SPID=\$PID$shard"
    ( sleep "$TIMEOUT_E2E_SHARD"; kill -9 "$SPID" 2>/dev/null ) &
    eval "WPID$shard=$!"
done

# Wait for all shards
E2E=1
for shard in 1 2 3 4; do
    eval "PID=\$PID$shard"

    wait $PID
    EXIT_CODE=$?

    # Cancel this shard's watchdog now that it has finished
    eval "WPID=\$WPID$shard"
    kill "$WPID" 2>/dev/null
    wait "$WPID" 2>/dev/null

    if [ $EXIT_CODE -eq 0 ]; then
        echo "  ✅ Shard $shard/4 passed"
    elif [ $EXIT_CODE -ge 128 ]; then
        echo "  ⏱️  Shard $shard/4 TIMED OUT after ${TIMEOUT_E2E_SHARD}s and was killed"
        echo "     See $E2E_LOG_DIR/shard-$shard.log for details"
        E2E=0
    else
        echo "  ❌ Shard $shard/4 failed (exit code $EXIT_CODE)"
        echo "     See $E2E_LOG_DIR/shard-$shard.log for details"
        E2E=0
    fi
done

# Re-enable set -e
set -e

# Show summary from shard logs
echo ""
echo "📊 E2E Summary:"
grep -h "passed\|failed" "$E2E_LOG_DIR"/*.log 2>/dev/null | grep -E "^\s*[0-9]+" || echo "  (no summary available)"

# Clean up logs on success, keep on failure for debugging
if [ $E2E -eq 1 ]; then
    rm -rf "$E2E_LOG_DIR"
    echo ""
    echo "✅ E2E tests passed (all shards)"
else
    echo ""
    echo "❌ E2E tests failed (some shards)"
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
