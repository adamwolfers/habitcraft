# Testing Guide

This document covers the testing infrastructure, conventions, and isolation strategies used in HabitCraft.

## Test Types

| Type | Framework | Location | Purpose |
|------|-----------|----------|---------|
| Backend Unit | Jest + Supertest | `backends/node/tests/` | API endpoint and middleware testing |
| Backend Integration | Jest + Supertest | `backends/node/tests/integration/` | Full database workflows |
| Frontend Unit | Jest + RTL | `frontends/nextjs/**/*.test.tsx` | Component and hook testing |
| E2E | Playwright | `frontends/nextjs/e2e/` | Full user journey testing |

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
| `backends/node/.env.test` | Test database connection, test JWT secret |
| `frontends/nextjs/.env.test` | Test API URL |

## Running Tests

### All Tests

```bash
scripts/test-all.sh           # Run all tests sequentially
scripts/test-all.sh --rebuild # Rebuild containers first
```

### Backend

```bash
cd backends/node
npm test                      # Unit tests
npm run test:integration      # Integration tests (requires test db)
```

### Frontend

```bash
cd frontends/nextjs
npm test                      # Unit tests
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

Located in `backends/node/tests/integration/`:

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

### Mocking API Calls

Frontend tests mock the API client:

```typescript
jest.mock('@/lib/api', () => ({
  fetchHabits: jest.fn(),
  createHabit: jest.fn(),
  // ...
}));
```

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
cd backends/node && npm test -- --coverage

# Frontend
cd frontends/nextjs && npm test -- --coverage
```
