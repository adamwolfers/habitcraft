#!/bin/bash

# Verify that every Playwright E2E shard actually has tests to run.
#
# Usage:
#   ./scripts/check-e2e-shards.sh <total>           # check every shard 1..total
#   ./scripts/check-e2e-shards.sh <total> <shard>   # check a single shard
#
# WHY THIS EXISTS (habitcraft-u1o)
#
# playwright.config.ts sets fullyParallel: false, so Playwright shards by FILE,
# not by test, and assigns each file to the shard its FIRST test falls into.
# With unevenly sized spec files that can strand a shard with nothing to do:
# auth(30) completions(33) habits(11) landing(10) split across 4 shards gave
# 30 / 33 / 0 / 21, and shard 3 sat idle for weeks without anyone noticing.
#
# An empty shard is SILENT, not loud:
#   - it exits 0, so the runner reports "✅ Shard 3/4 passed";
#   - it prints no "N passed" line at all, so it contributes nothing to the
#     summary and its absence looks like a missing grep match (habitcraft-7oz).
#
# --pass-with-no-tests does NOT cover this. Playwright's no-tests-found failure
# applies to discovery, before sharding; an empty shard SLICE still exits 0.
# Verified on Playwright 1.57.0, 2026-08-17.
#
# So the shard count has to stay matched to the spec-file layout, and this
# check is what tells us when it stops matching.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

TOTAL_SHARDS="$1"
SINGLE_SHARD="$2"

if [ -z "$TOTAL_SHARDS" ]; then
    echo "Usage: $0 <total-shards> [shard]" >&2
    exit 1
fi

cd "$FRONTEND_DIR"

# Echoes the test count Playwright reports for a shard spec such as "2/3".
# Pass an empty spec to count the whole unsharded suite.
# "Total: 21 tests in 2 files" -> 21, and a run with no tests reports 0.
count_tests() {
    local shard_spec=$1
    local output
    local args=()

    [ -n "$shard_spec" ] && args=(--shard="$shard_spec")

    if ! output=$(npx playwright test "${args[@]}" --list 2>&1); then
        echo "❌ 'playwright test ${args[*]} --list' failed:" >&2
        echo "$output" >&2
        exit 1
    fi

    echo "$output" | sed -n 's/^Total: \([0-9][0-9]*\) test.*/\1/p' | tail -1
}

FAILED=0

if [ -n "$SINGLE_SHARD" ]; then
    # Per-shard mode: used by the CI matrix, where each job only knows its own
    # slice. Cannot check the sum, so it checks the one thing it can see.
    COUNT=$(count_tests "$SINGLE_SHARD/$TOTAL_SHARDS")
    if [ "${COUNT:-0}" -eq 0 ]; then
        echo "❌ Shard $SINGLE_SHARD/$TOTAL_SHARDS has 0 tests -- it would report 'passed' having run nothing."
        echo "   Playwright shards by file (fullyParallel: false); the shard count no longer"
        echo "   matches the spec-file layout. See habitcraft-u1o and docs/TESTING.md."
        exit 1
    fi
    echo "✅ Shard $SINGLE_SHARD/$TOTAL_SHARDS: $COUNT tests"
    exit 0
fi

# All-shards mode: used by test-all.sh, which can see every slice at once.
echo "🔍 Verifying all $TOTAL_SHARDS E2E shards have tests..."

EXPECTED=$(count_tests "")
SUM=0

for shard in $(seq 1 "$TOTAL_SHARDS"); do
    COUNT=$(count_tests "$shard/$TOTAL_SHARDS")
    COUNT=${COUNT:-0}
    SUM=$((SUM + COUNT))

    if [ "$COUNT" -eq 0 ]; then
        echo "  ❌ Shard $shard/$TOTAL_SHARDS: 0 tests (would report 'passed' having run nothing)"
        FAILED=1
    else
        echo "  ✅ Shard $shard/$TOTAL_SHARDS: $COUNT tests"
    fi
done

# Catches the other way a shard split can lose coverage: every shard non-empty
# but the slices no longer add up to the full suite.
if [ "$SUM" -ne "${EXPECTED:-0}" ]; then
    echo "  ❌ Shards total $SUM tests but the unsharded suite has ${EXPECTED:-0} -- tests are being dropped."
    FAILED=1
fi

if [ $FAILED -ne 0 ]; then
    echo ""
    echo "Playwright shards by file (fullyParallel: false), so the shard count must stay"
    echo "matched to the spec-file layout. Adjust the shard count in scripts/test-all.sh and"
    echo ".github/workflows/ci.yml together. See habitcraft-u1o and docs/TESTING.md."
    exit 1
fi

echo "✅ All $TOTAL_SHARDS shards have tests ($SUM total)"
