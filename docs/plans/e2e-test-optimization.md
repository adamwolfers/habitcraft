# E2E Test Suite Optimization Plan

## Overview

This document outlines strategies to reduce E2E test execution time, both locally and in CI. The test suite currently runs serially with a single worker, which is conservative but slow.

**Key insight**: Tests already use good isolation patterns (unique timestamps, read-only fixtures), making parallelization safe.

## Current State

- **Framework**: Playwright v1.57.0
- **Test Count**: 77 tests across 4 spec files
- **Execution Mode**: Serial (`fullyParallel: false`, `workers: 1`)
- **Browser**: Chromium only
- **Timeouts**: 30s per test, 5s for assertions

### Test Files

| File | Description | Tests |
|------|-------------|-------|
| `auth.spec.ts` | Login, registration, profile, password | ~35 |
| `completions.spec.ts` | Toggle, navigation, calendar views | ~22 |
| `habits.spec.ts` | CRUD operations | ~14 |
| `landing.spec.ts` | Public/authenticated access | ~6 |

### Current Test Isolation

Tests already use good isolation patterns:
- Fixture data (test users 1 & 2) are READ ONLY
- Data-modifying tests create unique users with `Date.now()` timestamps
- Each test is independent and can run in any order

---

## Phase 1: CI Sharding + Increased Workers

CI sharding is the lowest-risk optimization because each matrix job gets full isolation (separate Docker containers, separate database). No special handling needed.

### 1.1 CI Sharding with 2 Workers per Shard

**Impact**: 4-8x speedup in CI (4 shards × 2 workers)
**Effort**: Low
**Risk**: Low

Split tests across 4 parallel CI runners, each running 2 workers.

> **Note**: Each matrix shard runs as a separate GitHub Actions job with its own Docker containers and database, providing full isolation.

#### Prerequisites

The blob reporter (`--reporter=blob`) is passed via CLI, which overrides the config. Test this works before implementing:

```bash
npx playwright test --shard=1/4 --reporter=blob
ls blob-report/  # Should contain .zip files
```

#### Implementation: Update playwright.config.ts

```ts
// playwright.config.ts
workers: process.env.CI ? 2 : 1,  // 2 workers per shard in CI, 1 locally for debugging
```

#### Implementation: Update .github/workflows/ci.yml

```yaml
e2e-tests:
  name: E2E Tests (Shard ${{ matrix.shard }}/4)
  runs-on: ubuntu-latest
  needs: [backend-integration-tests]
  strategy:
    fail-fast: false
    matrix:
      shard: [1, 2, 3, 4]

  steps:
    # ... existing setup steps ...

    - name: Run E2E tests (shard ${{ matrix.shard }}/4)
      working-directory: frontends/nextjs
      run: npx playwright test --shard=${{ matrix.shard }}/4 --reporter=blob

    - name: Upload blob report (shard ${{ matrix.shard }})
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: blob-report-shard-${{ matrix.shard }}
        path: frontends/nextjs/blob-report/
        retention-days: 1
```

Add merge job:

```yaml
e2e-merge-reports:
  name: Merge E2E Reports
  runs-on: ubuntu-latest
  needs: [e2e-tests]
  if: always()
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - name: Install Playwright
      working-directory: frontends/nextjs
      run: npm install @playwright/test
    - name: Download all blob reports
      uses: actions/download-artifact@v4
      with:
        pattern: blob-report-shard-*
        path: all-blob-reports
        merge-multiple: true
    - name: Merge reports
      working-directory: frontends/nextjs
      run: npx playwright merge-reports --reporter html ../../all-blob-reports
    - name: Upload merged report
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: frontends/nextjs/playwright-report/
        retention-days: 7
```

#### Files to Modify

1. `.github/workflows/ci.yml` - Add matrix strategy and merge job
2. `frontends/nextjs/playwright.config.ts` - Update workers to 2 in CI
3. `.gitignore` - Add `blob-report/`

#### Verify Before Merging

1. Test blob reporter locally:
   ```bash
   npx playwright test --shard=1/4 --reporter=blob
   ls blob-report/
   ```

2. Confirm test distribution (all tests run exactly once):
   ```bash
   cd frontends/nextjs
   for shard in 1 2 3 4; do
       echo "=== Shard $shard/4 ==="
       npx playwright test --list --shard=$shard/4 2>/dev/null | grep -c "test" || echo "0"
   done
   # Total should equal 77 (current test count)
   ```

3. The merge job path `../../all-blob-reports` is correct - verify in a test PR.

---

## Phase 2: Local Parallel Sharding

After CI sharding is stable, apply similar optimization to local `test-all.sh`.

### 2.1 Local Parallel Sharding

**Impact**: 2-4x speedup for `test-all.sh`
**Effort**: Medium
**Risk**: Low (tests already use proper isolation)

Run 4 parallel shards locally in `scripts/test-all.sh`.

> **Note**: After this change, `test-all.sh` runs 4 parallel shards while `npm run test:e2e` stays serial (for easier debugging). Document this difference clearly for developers.

#### Challenge: Global Setup Race Condition

The current `global-setup.ts` resets the test database before each test run. When running 4 shards in parallel, each shard triggers global-setup, causing:
- Multiple simultaneous DB resets
- Race conditions where one shard resets while another is running tests

#### Solution: Conditional Global Setup

Modify `global-setup.ts` to skip DB reset when `SKIP_E2E_SETUP=1` environment variable is set:

```ts
// frontends/nextjs/e2e/global-setup.ts
async function globalSetup() {
  console.log('\n🚀 Setting up E2E tests...\n');
  const projectRoot = resolve(__dirname, '../../..');

  // Skip DB reset if SKIP_E2E_SETUP is set (used by test-all.sh for parallel shards)
  if (process.env.SKIP_E2E_SETUP) {
    console.log('⏭️  Skipping database reset (SKIP_E2E_SETUP=1)\n');
  } else {
    try {
      console.log('📦 Resetting test database...');
      execSync(`${projectRoot}/scripts/test-db-reset.sh`, {
        stdio: 'inherit',
        cwd: projectRoot,
      });
      console.log('✅ Test database reset complete\n');
    } catch (error) {
      console.error('❌ Failed to reset test database');
      throw error;
    }
  }

  // Always verify services are accessible
  console.log('🔍 Verifying test services...');
  // ... existing service verification code ...
}
```

#### Implementation: Update test-all.sh

```bash
# 4. E2E Tests (parallel shards)
echo "🌐 [4/4] End-to-End Tests (4 parallel shards)"
echo "----------------------------------------------"
cd "$PROJECT_ROOT/frontends/nextjs"

# Reset database once before running shards
echo "  Resetting test database..."
"$PROJECT_ROOT/scripts/test-db-reset.sh" > /dev/null 2>&1

# Create temp directory for shard logs
E2E_LOG_DIR="$PROJECT_ROOT/frontends/nextjs/.e2e-shard-logs"
mkdir -p "$E2E_LOG_DIR"

# Disable set -e for parallel section (exit codes handled manually)
set +e

# Run 4 shards in parallel with SKIP_E2E_SETUP to avoid duplicate DB resets
E2E_PIDS=()
for shard in 1 2 3 4; do
    SKIP_E2E_SETUP=1 npx playwright test --shard=$shard/4 \
        > "$E2E_LOG_DIR/shard-$shard.log" 2>&1 &
    E2E_PIDS+=($!)
    echo "  Started shard $shard/4 (PID ${E2E_PIDS[-1]})"
done

# Wait for all shards with timeout to catch hangs (3 min per shard - ~4x expected time)
SHARD_TIMEOUT=180
E2E=1
for i in 0 1 2 3; do
    shard=$((i + 1))

    # Wait with timeout using background subshell
    ( sleep $SHARD_TIMEOUT; kill ${E2E_PIDS[$i]} 2>/dev/null ) &
    TIMEOUT_PID=$!

    wait ${E2E_PIDS[$i]}
    EXIT_CODE=$?

    # Cancel timeout if process finished
    kill $TIMEOUT_PID 2>/dev/null || true

    if [ $EXIT_CODE -eq 0 ]; then
        echo "  ✅ Shard $shard/4 passed"
    elif [ $EXIT_CODE -eq 137 ] || [ $EXIT_CODE -eq 143 ]; then
        echo "  ⏰ Shard $shard/4 timed out after ${SHARD_TIMEOUT}s"
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
```

> **Note**: On macOS with Homebrew, you can simplify the timeout handling using `gtimeout` from coreutils:
> ```bash
> gtimeout 180s npx playwright test --shard=$shard/4 > "$log" 2>&1 &
> ```

#### Files to Modify

1. `frontends/nextjs/e2e/global-setup.ts` - Add SKIP_E2E_SETUP check
2. `scripts/test-all.sh` - Run parallel shards
3. `.gitignore` - Add `.e2e-shard-logs/`

#### Testing

```bash
# Run the full test suite with parallel E2E
./scripts/test-all.sh

# Verify all 4 shards start and complete
# Check timing improvement vs serial execution
```

---

## Phase 3: Additional Optimizations (Future)

### 3.1 Enable Parallel Execution Within Files

**Impact**: Moderate speedup
**Effort**: Low
**Risk**: Low

Use `test.describe.configure({ mode: 'parallel' })` for independent test groups within the same file.

### 3.2 Reduce Test Timeouts

**Impact**: Low-Moderate (faster failure detection)
**Effort**: Low
**Risk**: Low

The current 30s timeout is conservative. Most operations complete in 10-15s. Consider:
- Set default to 15s
- Override to 30s only for specific slow tests (e.g., complex multi-step flows)

### 3.3 Reuse Authentication State (Low Priority)

**Impact**: Moderate
**Effort**: Medium
**Risk**: Medium

Create authenticated browser state once and reuse across tests.

> **Note**: Given that tests already create unique users and we're optimizing with sharding, auth state reuse adds complexity for minimal gain. Deprioritize unless sharding proves insufficient.

### 3.4 Parallelize Container Build with Unit Tests

**Impact**: Moderate (overlaps build time with test time)
**Effort**: Medium
**Risk**: Low

Currently, e2e-tests waits for backend-integration-tests before starting container build. The Docker bake step could be a separate job that runs in parallel with unit tests, so containers are ready when e2e-tests starts.

---

## Measuring Performance

### Baseline Metrics

```bash
cd frontends/nextjs

# Time full test run
time npx playwright test 2>&1 | tail -1

# Find slowest tests
npx playwright test --reporter=json 2>/dev/null | jq '
  [.suites[].specs[].tests[] | {
    title: .title,
    duration: .results[0].duration
  }] | sort_by(-.duration) | .[0:10]
'
```

---

## Implementation Order

1. **Phase 1.1: CI Sharding + Workers** - Update GitHub Actions workflow and playwright.config.ts (lowest risk, highest impact)
2. **Phase 2.1: Local Parallel Sharding** - Modify global-setup.ts and test-all.sh (after CI is stable)
3. **Phase 3.x: Additional optimizations** - As needed based on measurements

---

## Success Criteria

- Local `test-all.sh` E2E time reduced by 50%+
- CI E2E job time reduced by 50%+
- All 77 tests run exactly once across shards (verified before merge)
- No increase in test flakiness
- `npm run test:e2e` still works unchanged (for debugging single tests)
