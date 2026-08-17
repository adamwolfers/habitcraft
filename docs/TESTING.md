# Testing Guide

This document covers the testing infrastructure, conventions, and isolation strategies used in HabitCraft.

## Test Types

| Type | Framework | Location | Purpose |
|------|-----------|----------|---------|
| Backend Unit | Jest + Supertest | `backend/**/*.test.js` (colocated) | API endpoint and middleware testing |
| Backend Integration | Jest + Supertest | `backend/integration/` | Full database workflows |
| Frontend Unit | Jest + RTL | `frontend/**/*.test.tsx` | Component and hook testing |
| E2E | Playwright | `frontend/e2e/` | Full user journey testing |
| Doc Links | lychee | all tracked `*.md` | Relative links still resolve after files move |
| CI Path Filters | plain node + picomatch | `scripts/verify-ci-filters.js` | `ci.yml` path filters select the right jobs |

### CI Path Filter Verification

The `detect-changes` filter block in `.github/workflows/ci.yml` decides which
jobs run. Its defects are invisible on inspection and never fail loudly — a
filter that matches nothing, or a file that triggers the workflow while matching
no filter, both produce a green run that tested nothing. Two such defects
shipped before this check existed.

```bash
npm run verify:ci-filters      # from the repo root
node scripts/verify-ci-filters.js [path/to/ci.yml]
```

It parses the live `filters: |` block, the `predicate-quantifier`, the `push` and
`pull_request` triggers' `paths-ignore` lists, and the job gates out of `ci.yml`
(rather than duplicating them, which would drift), evaluates patterns with
picomatch — the library `dorny/paths-filter` uses — and asserts five things:

1. A table of representative files yields the expected trigger decision and the
   expected set of true filter outputs.
2. No filter is dead: every filter matches at least one case.
3. No tracked file triggers the workflow while matching zero filters
   (`git ls-files` sweep).
4. No deploy job is gated on a filter that a test file can satisfy. Jobs that
   build, push or submit an artifact are detected from their own bodies, and
   every filter their `if:` reads is checked against the tracked test files. A
   deploy gated on a test-inclusive filter means a test-only commit ships a
   revision identical to the previous one (habitcraft-irq, -2db, -688).
5. The `push` and `pull_request` triggers declare identical `paths-ignore` lists,
   as the comment on the `pull_request` copy claims. Checks 1–4 evaluate the
   `push` list, so a path dropped from only the `pull_request` copy would leave
   them all passing while PRs fired the workflow for files `push` ignores
   (habitcraft-8mn). Only `paths-ignore` is compared — `push` also carries
   `branches: ['**']` and `tags: ['mobile-v*']` where `pull_request` carries
   `branches: [main, master]`, and that asymmetry is intentional.

Runs in CI as the `verify-ci-filters` job, gated on the `tooling` and `workflow`
filters — so it gates both itself and the config it checks.

**Limitation:** this verifies *pattern semantics* only. It cannot exercise
GitHub's own `paths-ignore` evaluation or the action's git diff behaviour, so it
complements a real push rather than replacing one.

### Doc Link Checking

Docs link between packages with depth-encoded relative paths (e.g.
`../../PROJECT_PLAN.md`). Moving a directory up or down a level silently breaks
them, and a grep for the old path does not catch it. `lychee` verifies every
relative link still resolves.

Run locally the same way CI does:

```bash
docker run --rm -v "$PWD:/input" -w /input lycheeverse/lychee:latest \
  --config lychee.toml './**/*.md'
```

Configured in `lychee.toml`; runs via `.github/workflows/link-check.yml`, which
is separate from `ci.yml` because that workflow ignores markdown changes. Only
local files are checked — external URLs are skipped deliberately, since they
fail for reasons unrelated to this repo and would make the gate flaky.

**Limitation:** only markdown *links* are checked. Relative paths inside fenced
code blocks (shell commands like `cd ../..` or
`docker compose -f ../../docker-compose.test.yml`) are invisible to any link
checker and must still be updated by hand when a directory moves.

## Test Infrastructure

### Test Database

A separate Docker container runs the test database to avoid conflicts with development:

| Property | Value |
|----------|-------|
| Container | `docker-compose.test.yml` |
| Database | `habitcraft_test` |
| Port | 5433 (dev uses 5432) |
| Schema | Same as production (`shared/database/schema.sql`) |

### Setup Scripts

Located in `scripts/`:

| Script | Purpose |
|--------|---------|
| `test-db-start.sh` | Start test database container |
| `test-db-stop.sh` | Stop test database container |
| `test-db-reset.sh` | Reset to clean state with fixtures |
| `test-db-fresh.sh` | Remove all data and start fresh |

### Test Fixtures

Located in `shared/database/test-fixtures.sql`:

| User | Email | Password | UUID |
|------|-------|----------|------|
| Test User 1 | `test@example.com` | `Test1234!` | `11111111-...` |
| Test User 2 | `test2@example.com` | `Test1234!` | `22222222-...` |

Both users have sample habits with predictable UUIDs and sample completions.

### Environment Variables

| File | Purpose |
|------|---------|
| `backend/.env.test` | Test database connection, test JWT secret |
| `frontend/.env.test` | Test API URL |

## Running Tests

### All Tests

```bash
scripts/test-all.sh           # Run all tests sequentially
scripts/test-all.sh --rebuild # Rebuild containers first
```

Each phase runs under a wall-clock timeout (see `TIMEOUT_*` at the top of
`scripts/test-all.sh`), so a wedged or leaked handle fails that phase instead of
stalling the whole suite. A phase killed this way is reported as
`⏱️  TIMEOUT: phase exceeded Ns` and is distinct from an ordinary test failure.
Raise the relevant `TIMEOUT_*` value if a phase legitimately outgrows its budget.

Each watchdog is spawned under job control (`set -m`) so it is its own process
group leader, and cancelling one uses `kill -- -$PID` to take the group. Killing
only the watchdog subshell would leave its `sleep` running as an orphan holding
the script's stdout open, which makes any piped or captured invocation
(`| tail`, `| tee`, `$(...)`, a CI log collector) hang silently for the full
timeout *after* the suite has already finished — habitcraft-da5. Keep both
halves if you touch the watchdogs.

### Backend

```bash
cd backend
npm test                      # Unit tests
npm run test:integration      # Integration tests (requires test db)
```

### Frontend

```bash
cd frontend
npm test                      # Unit tests
npm run typecheck             # Type check (Jest/SWC does NOT check types)
npm run test:e2e              # E2E tests (headless)
npm run test:e2e:ui           # E2E tests with Playwright UI
npm run test:e2e:headed       # E2E tests in visible browser
npm run test:e2e:report       # View last test report
```

## E2E Test Isolation Strategy

### The Problem

Tests that modify fixture data (habits, user profile, completions) without restoration cause:
- Cross-test dependencies
- Failures when test order changes
- Flaky tests in parallel execution

### The Solution

**Create unique test data instead of modifying fixtures.**

### Data Strategy

| User | Role | Usage |
|------|------|-------|
| User 1 (`test@example.com`) | **READ ONLY** | Login for read-only operations, fixture habit viewing |
| User 2 (`test2@example.com`) | **Validation reference** | Never logged in as; only used for "email already taken" checks |

**Key rule:** All data-modifying tests create unique entities with `Date.now()` timestamps.

### Implementation by Test File

#### `e2e/habits.spec.ts` — Habit Update Tests

```typescript
// Helper creates unique habits with timestamp
async function createTestHabit(page: Page, name: string) {
  const uniqueName = `${name}-${Date.now()}`;
  // ... create habit via UI
  return uniqueName;
}

// Each test creates its own habit before testing
test('should update habit title', async ({ page }) => {
  const habitName = await createTestHabit(page, 'Update Title Test');
  // ... test the update
});
```

All 5 update tests create their own habits before testing.

#### `e2e/auth.spec.ts` — Profile Management Tests

- Profile update tests register unique users before testing
- "Email already taken" tests create unique users, then check against User 1's email
- Profile Modal describe block creates unique users for each test

```typescript
test('should show error when email already taken', async ({ page }) => {
  // Register a unique user
  const uniqueEmail = `unique-${Date.now()}@example.com`;
  await registerUser(page, uniqueEmail, 'password');

  // Try to change to User 1's email (fixture user)
  await updateEmail(page, 'test@example.com');
  await expect(page.getByText('Email already in use')).toBeVisible();
});
```

#### `e2e/completions.spec.ts` — Completion Tracking Tests

- Toggle tests create unique habits using `createTestHabit` helper
- "Track completions independently" test creates two unique habits
- Navigation/display tests use fixture habits (read-only, safe)

### Guidelines for New E2E Tests

1. **Never modify fixture users or their existing data**
2. **Create unique entities for any test that modifies data:**
   ```typescript
   const uniqueName = `Test Entity ${Date.now()}`;
   ```
3. **For user-specific tests, register a new user:**
   ```typescript
   const email = `test-${Date.now()}@example.com`;
   await registerUser(page, email, 'SecurePass123!');
   ```
4. **Read-only operations can use fixture data safely**
5. **Clean up is handled by `test-db-reset.sh` between full test runs**

## Backend Integration Tests

Located in `backend/integration/`:

### Use the shared test server, not the app

Integration tests must issue requests against the shared server from
`getTestServer()`, never against the bare app:

```javascript
const { getTestServer } = require('./setup');

const testServer = getTestServer();

// Correct
await request(testServer).get('/api/v1/habits');

// Wrong — reintroduces the hang described below
await request(app).get('/api/v1/habits');
```

`request(app)` makes supertest start a throwaway server per request and close it
when the response ends. If a request never returns — a test that times out
mid-flight — that server is never closed, its handle keeps the event loop
alive, and jest idles forever after the run completes ("Jest did not exit one
second after the test run has completed"). A single such test turns a 20-second
failing run into an indefinite stall.

The shared server is started once per suite and torn down in `afterAll` with
`closeAllConnections()` followed by `close()`. The `closeAllConnections()` call
is load-bearing: `close()` on its own waits for in-flight connections and would
hang on exactly the request that caused the problem.

### `auth.test.js` — Authentication Flows
- Register → Login → Access Protected Route
- Login → Token Refresh → Continue Session
- Invalid Credentials → Proper Error Response
- User isolation verification
- Logout and session invalidation
- Token expiration handling

### `habits.test.js` — Habit CRUD
- Full CRUD cycle with real database
- User isolation (can't access other users' data)
- Cascading deletes (habits → completions)
- Status filtering with real data
- Update validations with database constraints

### `completions.test.js` — Completion Tracking
- Create completion → Verify in database
- Date filtering with real data
- Delete completion → Verify removal
- Duplicate prevention (409 Conflict)
- Habit ownership validation

### `users.test.js` — Account Deletion
- Delete account → Verify every FK-chained row is gone, other users untouched
- Wrong password rejected, account left intact
- Password confirmation and authentication required
- Pooled client released on both success and failure (more requests than the
  pool size; a leak would exhaust it)
- Session unusable after deletion

These cases must stay **integration** tests. The endpoint they cover was broken
in production for seven months behind green unit tests (habitcraft-3h9) because
the unit mock fabricated the pool method the route called — see "Mocking the
Database Pool" above. Only the real pool can catch that.

## Test Patterns

### Extract Logic for Testability

See `CLAUDE.md` for the full pattern documentation. In brief:

**Problem:** React component logic using closures captures state at render time, making edge cases hard to test.

**Solution:** Extract logic to pure utility functions:

```typescript
// utils/habitUtils.ts (testable)
export function findHabitById(habits: Habit[], id: string): Habit | undefined {
  return habits.find((h) => h.id === id);
}

// Component (uses the utility)
const habit = findHabitById(habits, habitId);
```

### Mocking the Database Pool (backend)

Backend unit tests mock the pg pool and queue one result per query, in order:

```javascript
jest.mock('../db/pool');
const pool = require('../db/pool');

pool.query.mockResolvedValueOnce({ rows: [habit] });
```

**Trap:** the mock chain is positional, so adding code that issues a *new*
query — e.g. middleware doing a `COUNT` before an `INSERT` — shifts every
subsequent result by one and breaks **all** existing tests that mock that
route, not just the new one. When you add a query, update the mock chains
across the whole suite, not only the test you are working on.

**Never assign a method onto the mocked module.** `db/pool` exports exactly
`{ getPool, query, closePool }`. A line like `pool.connect = jest.fn()` does not
mock anything — it *invents* an API the real module has never had, and every
test written against it passes while production throws
`TypeError: pool.connect is not a function`.

That is not hypothetical: it is what habitcraft-3h9 was. `DELETE
/api/v1/users/me` called `pool.connect()` to open a transaction, 500'd on every
request for seven months, and eight green unit tests certified it the whole
time. Transaction clients come from the pg Pool *behind* the module:

```javascript
// Route: reach through getPool() for a transaction client
const client = await pool.getPool().connect();

// Test: mock the exported function, never a fabricated one
pool.getPool.mockReturnValue({ connect: jest.fn().mockResolvedValue(mockClient) });
```

`backend/routes/users.test.js` builds its mock from the real module's key set
and `Object.seal`s it, so the mock cannot grow a method the module lacks. Prefer
that factory when mocking `db/pool`.

**A sealed mock is a backstop, not proof.** Only a test driving the real pool
can show a route actually works, so any route taking a transaction client needs
integration coverage — see `users.test.js` below.

### Validator Chain Ordering

`express-validator` chains run **in declaration order**, and the first failure
short-circuits the rest. On the register email field
(`backend/routes/auth.js`), `.isEmail()` precedes `.isLength({ max: 255 })`, so
a 300-character malformed email fails on *format*, never on *length*.

When testing a length validator on an email, either use a valid-format address
that exceeds the limit, or assert that the response matches **either** error
message. Otherwise the test passes for the wrong reason.

### Mocking API Calls

Frontend tests mock the API client:

```typescript
jest.mock('@/lib/api', () => ({
  fetchHabits: jest.fn(),
  createHabit: jest.fn(),
  // ...
}));
```

### Mocking Auth Context

Always build `useAuth()` return values with the shared factory in
`frontend/test-utils/mockAuthContext.ts` — never hand-roll the object literal:

```typescript
import { createMockAuth } from '@/test-utils/mockAuthContext';

mockUseAuth.mockReturnValue(createMockAuth()); // logged out
mockUseAuth.mockReturnValue(createMockAuth({ isLoading: true })); // still checking session
mockUseAuth.mockReturnValue(createMockAuth({ user: mockUser })); // logged in
mockUseAuth.mockReturnValue(createMockAuth({ logout: mockLogout })); // assert on a call
```

`isAuthenticated` defaults to `user != null`, mirroring `AuthProvider`'s own
derivation, so you rarely pass it. Overrides are applied last and always win, so
pass it explicitly to model an inconsistent state.

The factory's return type is annotated as `AuthContextType`, so adding a field to
the context fails compilation in that one file instead of silently drifting across
every test that mocks auth. Hand-rolled literals are how 29 type errors accumulated
unnoticed (habitcraft-b28) — SWC strips types during Jest runs without checking them,
so a green test suite proves nothing about types. Run `npm run typecheck` from
`frontend/` to check them; CI runs the same step, so type errors now fail the build
(habitcraft-chm).

### Testing Loading States

```typescript
it('shows loading state while fetching', async () => {
  mockFetchHabits.mockImplementation(() => new Promise(() => {})); // Never resolves
  render(<Component />);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});
```

## Current Test Coverage

- **E2E Tests:** 50 tests across authentication, habits, and completions
- **Target Coverage:** >90% for both backend and frontend

Run coverage reports:

```bash
# Backend
cd backend && npm test -- --coverage

# Frontend
cd frontend && npm test -- --coverage
```
