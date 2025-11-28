#!/bin/bash

# Run all tests sequentially to avoid database conflicts
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

# Exit with error if any tests failed
TOTAL=$((BACKEND_UNIT + FRONTEND_UNIT + INTEGRATION + E2E))
if [ $TOTAL -eq 4 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "💥 Some tests failed"
    exit 1
fi
