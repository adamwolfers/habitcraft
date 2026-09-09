/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/tests/**/*.test.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  // Runs once per test file, which is what makes the logged-out
  // precondition a harness guarantee rather than a per-spec convention
  // (habitcraft-bqhe.7).
  setupFilesAfterEnv: ['<rootDir>/e2e/config/perFileSetup.ts'],
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  verbose: true,
};
