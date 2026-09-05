/**
 * Jest Integration Test Setup
 *
 * Loads .env.test and configures the test environment
 */

// Load test environment variables
require('dotenv').config({ path: '.env.test' });

// Ensure we're in test mode
process.env.NODE_ENV = 'test';

// Import setup utilities
const {
  closeTestPool,
  resetTestDatabase,
  whenTestServerReady,
  closeTestServer,
} = require('./integration/setup');
const { closePool: closeAppPool } = require('./db/pool');
const { drainViolations, flushCoverage } = require('./openapi/responseValidator');

// Reset database before all tests
beforeAll(async () => {
  await whenTestServerReady();
  console.log('\n📦 Resetting test database before integration tests...');
  await resetTestDatabase();
  console.log('✅ Test database ready\n');
});

// Every response the suite provoked was checked against
// shared/api-spec/openapi.yaml on its way out (see openapi/httpInterceptor.js).
// Mismatches are collected rather than thrown, because throwing inside the
// response would surface as a 500 from the route under test. Draining them
// here attributes each one to the test that caused it (habitcraft-34d.2).
afterEach(() => {
  const violations = drainViolations();
  if (violations.length > 0) {
    throw new Error(
      `${violations.length} response(s) did not match shared/api-spec/openapi.yaml:\n\n` +
        `${violations.join('\n\n')}\n\n` +
        `Fix the handler, or update the spec if the new shape is intended -- ` +
        `both clients read that spec.`
    );
  }
});

// Clean up after all tests
afterAll(async () => {
  // Jest gives each test FILE its own module registry, so this file's coverage
  // has to reach disk for globalTeardown to see the union across files. The
  // file name goes with it: globalTeardown only enforces coverage once every
  // test file has reported, so a filtered run cannot fail on it.
  flushCoverage(expect.getState().testPath);

  // Server first: it drops in-flight connections, so any request still holding
  // a pooled client is released before the pools are asked to drain.
  await closeTestServer();
  await closeTestPool();
  await closeAppPool();
});
