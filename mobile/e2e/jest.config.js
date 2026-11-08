/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/tests/**/*.test.ts'],
  // Hooks share this timeout, and the launches inside them are retried once
  // when the app never started (e2e/config/launchRetry.ts). Detox spends about
  // 100s on the failed attempt, and the second launch then has to reach its
  // screen within its own 30s wait. 120s leaves no room for that retry
  // (habitcraft-nu7h). A passing test is no slower for this;
  // only a hung one takes longer to fail.
  testTimeout: 240000,
  maxWorkers: 1,
  // Runs once per test file, which is what makes the logged-out
  // precondition a harness guarantee rather than a per-file convention
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
