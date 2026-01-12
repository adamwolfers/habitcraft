import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for GCP Production
 *
 * This config runs tests against the deployed GCP environment.
 *
 * Test credentials (created during GCP validation):
 * - Email: gcptest12345@example.com
 * - Password: TestPass123
 *
 * Usage:
 *   # After DNS cutover (uses custom domains):
 *   npx playwright test --config=playwright.gcp.config.ts
 *
 *   # Before DNS cutover (uses Cloud Run URLs directly):
 *   USE_CLOUDRUN_URLS=1 npx playwright test --config=playwright.gcp.config.ts
 *
 * Note: This skips database reset since we're testing against production.
 * Only run non-destructive tests or tests that create unique data.
 */

// Use Cloud Run URLs directly (before DNS cutover) or custom domains (after cutover)
const USE_CLOUDRUN_URLS = process.env.USE_CLOUDRUN_URLS === '1';

const GCP_FRONTEND_URL = USE_CLOUDRUN_URLS
  ? 'https://habitcraft-frontend-iz7ggma5ga-uc.a.run.app'
  : 'https://www.habitcraft.org';
const GCP_BACKEND_URL = USE_CLOUDRUN_URLS
  ? 'https://habitcraft-backend-iz7ggma5ga-uc.a.run.app'
  : 'https://api.habitcraft.org';

export default defineConfig({
  // Directory containing E2E tests
  testDir: './e2e',

  // Only run the GCP smoke test file
  testMatch: 'gcp-smoke.spec.ts',

  // Run tests serially
  fullyParallel: false,

  // No retries for smoke tests - we want to see failures immediately
  retries: 0,

  // Single worker
  workers: 1,

  // Reporter
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report-gcp' }],
    ['list']
  ],

  // Shared settings
  use: {
    // GCP Frontend URL
    baseURL: GCP_FRONTEND_URL,

    // Use UTC timezone for consistent date handling
    timezoneId: 'UTC',

    // Capture traces and screenshots on failure
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',

    // Longer timeouts for cloud environment (cold starts)
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Configure projects
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Custom global setup for GCP (just connectivity check, no DB reset)
  globalSetup: require.resolve('./e2e/gcp-global-setup.ts'),

  // Timeout for each test (longer for cloud)
  timeout: 60000,

  // Timeout for expect assertions
  expect: {
    timeout: 10000,
  },

  // Output directory
  outputDir: 'playwright-results-gcp',
});
