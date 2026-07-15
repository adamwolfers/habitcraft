/**
 * Jest Configuration for Integration Tests
 *
 * Run with: npm run test:integration
 * Requires test database to be running: ./scripts/test-db-start.sh
 */
module.exports = {
  testEnvironment: 'node',
  // Only run integration tests
  testMatch: ['**/integration/**/*.test.js'],
  // Use .env.test for database configuration
  setupFilesAfterEnv: ['<rootDir>/jest.integration.setup.js'],
  // Longer timeout for database operations
  testTimeout: 30000,
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  // Coverage for integration tests
  collectCoverage: false,
  // Verbose output
  verbose: true,
};
