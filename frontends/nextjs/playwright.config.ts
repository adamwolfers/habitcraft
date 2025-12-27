import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Test environment:
 * - Backend: http://localhost:3010 (test database on port 5433)
 * - Frontend: http://localhost:3110
 *
 * Before running E2E tests:
 * 1. Start the test database: ./scripts/test-db-fresh.sh (from project root)
 * 2. Start the test services: docker compose -f docker-compose.test.yml up
 *
 * Test credentials (from test-fixtures.sql):
 * - User 1: test@example.com / Test1234!
 * - User 2: test2@example.com / Test1234!
 */

export default defineConfig({
  // Directory containing E2E tests
  testDir: './e2e',

  // Run tests serially - E2E tests share database state and can interfere
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // 2 workers per shard in CI (shards provide isolation), 1 locally for debugging
  workers: process.env.CI ? 2 : 1,

  // Reporter to use
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],

  // Shared settings for all projects
  use: {
    // Base URL for the frontend
    baseURL: 'http://localhost:3110',

    // Use UTC timezone for consistent date handling across environments
    // This ensures the browser sees the same dates as the database (which uses UTC)
    timezoneId: 'UTC',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'on-first-retry',
  },

  // Configure projects for browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to add more browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Global setup - runs before all tests
  globalSetup: require.resolve('./e2e/global-setup.ts'),

  // Global teardown - runs after all tests
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),

  // Timeout for each test
  timeout: 30000,

  // Timeout for expect assertions
  expect: {
    timeout: 5000,
  },

  // Output directory for test artifacts
  outputDir: 'playwright-results',
});
