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
  // OpenAPI enforcement (habitcraft-34d.2): globalSetup clears the accumulated
  // operation-coverage file, globalTeardown reports it and fails the run if any
  // operation documented in shared/api-spec/openapi.yaml went unexercised.
  globalSetup: '<rootDir>/openapi/globalSetup.js',
  globalTeardown: '<rootDir>/openapi/globalTeardown.js',
  // Longer timeout for database operations
  testTimeout: 30000,
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  // Coverage for integration tests
  collectCoverage: false,
  // Verbose output
  verbose: true,
};
