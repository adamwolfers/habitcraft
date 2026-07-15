module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/*.test.js'],
  // Exclude integration tests from unit test runs
  testPathIgnorePatterns: ['/node_modules/', '/integration/'],
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/integration/**',
    '!jest.config.js',
    '!jest.setup.js',
    '!jest.integration.config.js',
    '!jest.integration.setup.js',
  ],
};
