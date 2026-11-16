import { defineConfig } from '@playwright/test';

/**
 * The post-deploy smoke check (smoke/*.smoke.ts, habitcraft-vxln.9.1), run by
 * scripts/smoke-check.sh against a base URL. Never retried: a retry would
 * register a second user and hide a flaky deploy.
 */
export default defineConfig({
  testDir: './smoke',
  testMatch: '**/*.smoke.ts',
  reporter: 'list',
  retries: 0,
  workers: 1,
  timeout: 60_000,
  outputDir: './test-results-smoke',
});
