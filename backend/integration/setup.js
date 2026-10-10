/**
 * Integration Test Setup
 *
 * Provides utilities for integration tests that run against the real test database.
 *
 * Prerequisites:
 * - Test database must be running: ./scripts/test-db-start.sh
 * - Use .env.test configuration: NODE_ENV=test npm run test:integration
 *
 * Test credentials (from test-fixtures.sql):
 * - User 1: test@example.com / Test1234! (UUID: 11111111-1111-1111-1111-111111111111)
 * - User 2: test2@example.com / Test1234! (UUID: 22222222-2222-2222-2222-222222222222)
 */

const { Pool } = require('pg');
const http = require('http');
const { execSync } = require('child_process');
const path = require('path');
const { interceptResponse } = require('../openapi/httpInterceptor');
const app = require('../app');

// Anchored to the backend package's own package.json rather than a walk up the
// tree for a root marker (habitcraft-3cr). Packages sit directly under the repo
// root, so the repo root -- home of scripts/ -- is the package root's parent.
const BACKEND_ROOT = path.dirname(require.resolve('../package.json'));
const REPO_ROOT = path.dirname(BACKEND_ROOT);

// Test database configuration (from .env.test)
//
// The timeouts exist for diagnosability, not speed (habitcraft-l3r). Every
// test's beforeEach runs quickReset() on this pool; without them a lock holder
// or a connect stalled in Docker's port forward blocks forever, and jest blames
// whichever test is next with a bare 30000ms testTimeout -- the unexplained
// signature on habitcraft-duf. With them the stall fails in seconds and says
// what it was waiting on. All sit well above normal test query time (observed
// max ~1s) and well below that 30000ms, so they never fire on a healthy run.
const testDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'habitcraft_test',
  user: process.env.DB_USER || 'habituser',
  password: process.env.DB_PASSWORD || 'habitpass',
  // pg's default is 0: wait forever for a connection.
  connectionTimeoutMillis: 5000,
  // Server-side, per session. lock_timeout fires first on a blocked lock and
  // names it ("canceling statement due to lock timeout"); statement_timeout is
  // the backstop for any other kind of stall.
  lock_timeout: 5000,
  statement_timeout: 10000,
};

// Create a dedicated pool for integration tests
let testPool = null;

// A single HTTP server shared by every request in a suite.
//
// Why not `request(app)`: supertest starts a throwaway server per request and
// closes it when the response ends. If a request never returns (a test that
// times out mid-flight), that server is never closed, its handle keeps the
// event loop alive, and jest idles forever after the run finishes. Owning one
// long-lived server lets afterAll tear it down deterministically. See
// habitcraft-doz.
let testServer = null;
let testServerReady = null;

/**
 * Get the shared test HTTP server, starting it on a random port if needed.
 *
 * Supertest reuses an already-listening server (and, importantly, does not
 * close it), so callers pass this instead of the bare app.
 * @returns {http.Server} Listening test server
 */
function getTestServer() {
  if (!testServer) {
    // Every response is checked against shared/api-spec/openapi.yaml on its
    // way out (habitcraft-34d.2). Wrapping the server rather than adding
    // express middleware means nothing can opt out: a route mounted later, or
    // a response express generates by itself, is still seen.
    testServer = http.createServer((req, res) => {
      interceptResponse(req, res);
      app(req, res);
    });
    testServerReady = new Promise((resolve, reject) => {
      testServer.once('listening', resolve);
      testServer.once('error', reject);
    });
    // Loopback, because that is where supertest connects. A bare listen(0)
    // binds every interface, and on macOS another process can then bind
    // 127.0.0.1 on the same port and receive the suite's requests
    // (habitcraft-oft7).
    testServer.listen(0, '127.0.0.1');
  }
  return testServer;
}

/**
 * Wait until the shared server is bound and has an address.
 *
 * listen() binds asynchronously; until it completes server.address() is null,
 * and supertest would try to listen a second time and throw.
 * @returns {Promise<void>}
 */
async function whenTestServerReady() {
  getTestServer();
  await testServerReady;
}

/**
 * Close the shared test server, dropping any in-flight connections.
 * @returns {Promise<void>}
 */
async function closeTestServer() {
  if (!testServer) return;

  const server = testServer;
  testServer = null;
  testServerReady = null;

  // Load-bearing: close() on its own waits for open connections to finish, so
  // a request that never returned would still hang teardown.
  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
  await new Promise((resolve) => server.close(() => resolve()));
}

/**
 * Get the test database pool
 */
function getTestPool() {
  if (!testPool) {
    testPool = new Pool(testDbConfig);
  }
  return testPool;
}

/**
 * Close the test database pool
 */
async function closeTestPool() {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Reset the test database to a clean state with fixtures
 * In CI: uses direct SQL (schema already initialized by workflow)
 * Locally: runs the test-db-reset.sh script via docker-compose
 */
async function resetTestDatabase() {
  // In CI environment, use direct SQL since schema is already set up
  if (process.env.CI) {
    const pool = getTestPool();
    try {
      // Clear all tables in correct order (respecting foreign keys)
      await pool.query('DELETE FROM completions');
      await pool.query('DELETE FROM habits');
      await pool.query('DELETE FROM refresh_tokens');
      await pool.query('DELETE FROM users');

      // Insert test fixtures
      await pool.query(`
        INSERT INTO users (id, email, password_hash, name)
        VALUES
          ('11111111-1111-1111-1111-111111111111', 'test@example.com', '$2b$10$w1PAvb7tS9BwyRI9SEKODOpOBIftLBpYg/k1gUFqHSmTs0ips.ws.', 'Test User'),
          ('22222222-2222-2222-2222-222222222222', 'test2@example.com', '$2b$10$w1PAvb7tS9BwyRI9SEKODOpOBIftLBpYg/k1gUFqHSmTs0ips.ws.', 'Test User 2')
        ON CONFLICT (id) DO NOTHING
      `);

      await pool.query(`
        INSERT INTO habits (id, user_id, name, description, color, icon, status)
        VALUES
          ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Morning Exercise', 'Daily workout', '#3B82F6', '🏃', 'active'),
          ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Read Books', 'Read 30 minutes', '#10B981', '📚', 'active'),
          ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Archived Habit', 'Archived', '#6B7280', '📦', 'archived'),
          ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'User 2 Habit', 'Belongs to user 2', '#F59E0B', '⭐', 'active')
        ON CONFLICT (id) DO NOTHING
      `);
      return;
    } catch (error) {
      console.error('Failed to reset test database via SQL:', error.message);
      throw new Error('Failed to reset test database in CI environment');
    }
  }

  // Locally, use the docker-compose based script
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'test-db-reset.sh');

  try {
    execSync(scriptPath, {
      stdio: 'pipe',
      cwd: REPO_ROOT,
    });
  } catch (error) {
    console.error('Failed to reset test database:', error.message);
    throw new Error(
      'Failed to reset test database. Make sure the test database is running: ./scripts/test-db-start.sh'
    );
  }
}

/**
 * Run a reset statement on the test pool, prefixing any error with the
 * statement's first line. A pg timeout error does not say which query it
 * cancelled, and these run in beforeEach, outside any test's own code.
 * @param {string} sql - Statement to run
 */
async function runResetQuery(sql) {
  try {
    await getTestPool().query(sql);
  } catch (error) {
    error.message = `${sql.trim().split('\n')[0]}: ${error.message}`;
    throw error;
  }
}

/**
 * Clear specific tables (faster than full reset for between-test cleanup)
 */
async function clearTables(tables = ['completions', 'habits', 'refresh_tokens', 'users']) {
  // Delete in order to respect foreign keys
  for (const table of tables) {
    await runResetQuery(`DELETE FROM ${table}`);
  }
}

/**
 * Insert test fixtures (users and habits)
 * Call after clearTables() to restore test data
 */
async function insertFixtures() {
  // Insert test users
  await runResetQuery(`
    INSERT INTO users (id, email, password_hash, name)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'test@example.com', '$2b$10$w1PAvb7tS9BwyRI9SEKODOpOBIftLBpYg/k1gUFqHSmTs0ips.ws.', 'Test User'),
      ('22222222-2222-2222-2222-222222222222', 'test2@example.com', '$2b$10$w1PAvb7tS9BwyRI9SEKODOpOBIftLBpYg/k1gUFqHSmTs0ips.ws.', 'Test User 2')
    ON CONFLICT (id) DO NOTHING
  `);

  // Insert test habits
  await runResetQuery(`
    INSERT INTO habits (id, user_id, name, description, color, icon, status)
    VALUES
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Morning Exercise', 'Daily workout', '#3B82F6', '🏃', 'active'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Read Books', 'Read 30 minutes', '#10B981', '📚', 'active'),
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Archived Habit', 'Archived', '#6B7280', '📦', 'archived'),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'User 2 Habit', 'Belongs to user 2', '#F59E0B', '⭐', 'active')
    ON CONFLICT (id) DO NOTHING
  `);
}

/**
 * Quick reset: clear tables and reinsert fixtures
 * Faster than resetTestDatabase() for between-test cleanup
 */
async function quickReset() {
  await clearTables();
  await insertFixtures();
}

/**
 * Test user credentials
 */
const testUsers = {
  user1: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'test@example.com',
    password: 'Test1234!',
    name: 'Test User',
  },
  user2: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'test2@example.com',
    password: 'Test1234!',
    name: 'Test User 2',
  },
};

/**
 * Test habit IDs
 */
const testHabits = {
  exercise: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  reading: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  archived: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  user2Habit: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
};

module.exports = {
  getTestPool,
  closeTestPool,
  getTestServer,
  whenTestServerReady,
  closeTestServer,
  resetTestDatabase,
  clearTables,
  insertFixtures,
  quickReset,
  testUsers,
  testHabits,
  testDbConfig,
};
