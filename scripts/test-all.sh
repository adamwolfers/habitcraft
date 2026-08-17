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

# Number of parallel Playwright shards. This is NOT free to change: Playwright
# shards by FILE (fullyParallel: false), so more shards than the spec-file
# layout can fill leaves one running nothing -- which reports as passed. Keep
# in sync with the matrix in .github/workflows/ci.yml, and let
# scripts/check-e2e-shards.sh (run below) confirm the split still works.
E2E_SHARDS=3

# Run a command with a wall-clock limit, returning its exit code.
# macOS has no coreutils `timeout`, so this uses a background watchdog.
run_with_timeout() {
    local timeout_secs=$1
    shift

    # Job control makes each background job its own process group leader, so
    # killing the group takes jest/playwright children with it rather than
    # orphaning them behind the npm wrapper. It matters just as much for the
    # watchdog: killing the watchdog subshell alone leaves its `sleep` running
    # (reparented to PID 1), and that orphan holds this script's stdout open,
    # so any piped invocation appears hung until the sleep expires -- see
    # habitcraft-da5.
    set -m
    "$@" &
    local cmd_pid=$!

    (
        sleep "$timeout_secs"
        kill -9 -"$cmd_pid" 2>/dev/null || kill -9 "$cmd_pid" 2>/dev/null
    ) &
    local watchdog_pid=$!
    set +m

    wait "$cmd_pid"
    local rc=$?

    # Cancel the watchdog if the command finished on its own. Kill the whole
    # group so the `sleep` inside the subshell dies with it.
    kill -- -"$watchdog_pid" 2>/dev/null
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
echo "🌐 [4/4] End-to-End Tests ($E2E_SHARDS parallel shards)"
echo "----------------------------------------------"
cd "$PROJECT_ROOT/frontend"

# Confirm the shard split still covers the suite BEFORE running anything. An
# empty shard exits 0 and prints no summary line, so without this the run would
# report all-green having skipped a slice -- see habitcraft-u1o.
if ! "$PROJECT_ROOT/scripts/check-e2e-shards.sh" "$E2E_SHARDS"; then
    echo ""
    echo "❌ E2E shard split is broken -- not running E2E tests"
    E2E=0
    E2E_SKIPPED=1
fi

if [ "${E2E_SKIPPED:-0}" -eq 0 ]; then

# Reset database once before running shards
echo "  Resetting test database..."
"$PROJECT_ROOT/scripts/test-db-reset.sh" > /dev/null 2>&1

# Create temp directory for shard logs
E2E_LOG_DIR="$PROJECT_ROOT/frontend/.e2e-shard-logs"
mkdir -p "$E2E_LOG_DIR"

# Disable set -e for parallel section (exit codes handled manually)
set +e

# Run the shards in parallel with SKIP_E2E_SETUP to avoid duplicate DB resets.
# Using eval'd individual variables rather than an array for compatibility with
# older bash (macOS /bin/bash is 3.x).
for shard in $(seq 1 "$E2E_SHARDS"); do
    SKIP_E2E_SETUP=1 npx playwright test --shard="$shard/$E2E_SHARDS" \
        > "$E2E_LOG_DIR/shard-$shard.log" 2>&1 &
    eval "PID$shard=$!"
    eval "echo \"  Started shard $shard/$E2E_SHARDS (PID \$PID$shard)\""
done

# One watchdog per shard. Playwright has its own per-test timeouts, but those
# do not cover a shard that wedges outside a test (or after the run finishes),
# which would leave the `wait` below blocking forever.
# Note: unlike run_with_timeout, these shards are not in their own process
# group, so only the shard PID is killed -- killing the group would take this
# script with it. The watchdogs themselves ARE their own group leaders (set -m)
# so that cancelling one below kills its `sleep` too -- see habitcraft-da5.
set -m
for shard in $(seq 1 "$E2E_SHARDS"); do
    eval "SPID=\$PID$shard"
    ( sleep "$TIMEOUT_E2E_SHARD"; kill -9 "$SPID" 2>/dev/null ) &
    eval "WPID$shard=$!"
done
set +m

# Wait for all shards
E2E=1
for shard in $(seq 1 "$E2E_SHARDS"); do
    eval "PID=\$PID$shard"

    wait $PID
    EXIT_CODE=$?

    # Cancel this shard's watchdog now that it has finished. Kill the whole
    # group so the `sleep` inside the subshell dies with it.
    eval "WPID=\$WPID$shard"
    kill -- -"$WPID" 2>/dev/null
    wait "$WPID" 2>/dev/null

    if [ $EXIT_CODE -eq 0 ]; then
        echo "  ✅ Shard $shard/$E2E_SHARDS passed"
    elif [ $EXIT_CODE -ge 128 ]; then
        echo "  ⏱️  Shard $shard/$E2E_SHARDS TIMED OUT after ${TIMEOUT_E2E_SHARD}s and was killed"
        echo "     See $E2E_LOG_DIR/shard-$shard.log for details"
        E2E=0
    else
        echo "  ❌ Shard $shard/$E2E_SHARDS failed (exit code $EXIT_CODE)"
        echo "     See $E2E_LOG_DIR/shard-$shard.log for details"
        E2E=0
    fi
done

# Re-enable set -e
set -e

# Show summary from shard logs. Print one line PER SHARD rather than grepping
# all logs at once: a shard whose log has no count line has to say so out loud,
# otherwise its absence just looks like a dropped grep match (habitcraft-7oz)
# instead of the missing run it actually is.
echo ""
echo "📊 E2E Summary:"
for shard in $(seq 1 "$E2E_SHARDS"); do
    COUNTS=$(grep -E "^\s*[0-9]+ (passed|failed|flaky|skipped|interrupted|did not run)" \
        "$E2E_LOG_DIR/shard-$shard.log" 2>/dev/null | sed 's/^[[:space:]]*//' | tr '\n' ' ')
    if [ -n "$COUNTS" ]; then
        echo "  Shard $shard/$E2E_SHARDS: $COUNTS"
    else
        echo "  Shard $shard/$E2E_SHARDS: ⚠️  no test counts in log -- did it run anything?"
    fi
done

# Clean up logs on success, keep on failure for debugging
if [ $E2E -eq 1 ]; then
    rm -rf "$E2E_LOG_DIR"
    echo ""
    echo "✅ E2E tests passed (all shards)"
else
    echo ""
    echo "❌ E2E tests failed (some shards)"
fi

fi  # end: E2E shard split verified

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
