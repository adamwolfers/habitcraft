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
const { closeTestPool, resetTestDatabase } = require('./integration/setup');
const { closePool: closeAppPool } = require('./db/pool');

// Reset database before all tests
beforeAll(async () => {
  console.log('\n📦 Resetting test database before integration tests...');
  await resetTestDatabase();
  console.log('✅ Test database ready\n');
});

// Clean up after all tests
afterAll(async () => {
  await closeTestPool();
  await closeAppPool();
});
