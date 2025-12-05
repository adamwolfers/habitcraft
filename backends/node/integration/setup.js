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
const { execSync } = require('child_process');
const path = require('path');

// Test database configuration (from .env.test)
const testDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'habitcraft_test',
  user: process.env.DB_USER || 'habituser',
  password: process.env.DB_PASSWORD || 'habitpass',
};

// Create a dedicated pool for integration tests
let testPool = null;

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
        INSERT INTO habits (id, user_id, name, description, frequency, color, icon, status)
        VALUES
          ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Morning Exercise', 'Daily workout', 'daily', '#3B82F6', '🏃', 'active'),
          ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Read Books', 'Read 30 minutes', 'daily', '#10B981', '📚', 'active'),
          ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Archived Habit', 'Archived', 'daily', '#6B7280', '📦', 'archived'),
          ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'User 2 Habit', 'Belongs to user 2', 'daily', '#F59E0B', '⭐', 'active')
        ON CONFLICT (id) DO NOTHING
      `);
      return;
    } catch (error) {
      console.error('Failed to reset test database via SQL:', error.message);
      throw new Error('Failed to reset test database in CI environment');
    }
  }

  // Locally, use the docker-compose based script
  const projectRoot = path.resolve(__dirname, '../../..');
  const scriptPath = path.join(projectRoot, 'scripts', 'test-db-reset.sh');

  try {
    execSync(scriptPath, {
      stdio: 'pipe',
      cwd: projectRoot,
    });
  } catch (error) {
    console.error('Failed to reset test database:', error.message);
    throw new Error(
      'Failed to reset test database. Make sure the test database is running: ./scripts/test-db-start.sh'
    );
  }
}

/**
 * Clear specific tables (faster than full reset for between-test cleanup)
 */
async function clearTables(tables = ['completions', 'habits', 'refresh_tokens', 'users']) {
  const pool = getTestPool();

  // Delete in order to respect foreign keys
  for (const table of tables) {
    await pool.query(`DELETE FROM ${table}`);
  }
}

/**
 * Insert test fixtures (users and habits)
 * Call after clearTables() to restore test data
 */
async function insertFixtures() {
  const pool = getTestPool();

  // Insert test users
  await pool.query(`
    INSERT INTO users (id, email, password_hash, name)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'test@example.com', '$2b$10$w1PAvb7tS9BwyRI9SEKODOpOBIftLBpYg/k1gUFqHSmTs0ips.ws.', 'Test User'),
      ('22222222-2222-2222-2222-222222222222', 'test2@example.com', '$2b$10$w1PAvb7tS9BwyRI9SEKODOpOBIftLBpYg/k1gUFqHSmTs0ips.ws.', 'Test User 2')
    ON CONFLICT (id) DO NOTHING
  `);

  // Insert test habits
  await pool.query(`
    INSERT INTO habits (id, user_id, name, description, frequency, color, icon, status)
    VALUES
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Morning Exercise', 'Daily workout', 'daily', '#3B82F6', '🏃', 'active'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Read Books', 'Read 30 minutes', 'daily', '#10B981', '📚', 'active'),
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Archived Habit', 'Archived', 'daily', '#6B7280', '📦', 'archived'),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'User 2 Habit', 'Belongs to user 2', 'daily', '#F59E0B', '⭐', 'active')
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
  resetTestDatabase,
  clearTables,
  insertFixtures,
  quickReset,
  testUsers,
  testHabits,
  testDbConfig,
};
