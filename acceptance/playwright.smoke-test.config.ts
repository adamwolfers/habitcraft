import { defineConfig } from '@playwright/test';

/**
 * The post-deploy smoke check's own tests (smoke/*.test.ts, habitcraft-vxln.9.1).
 * They run the check against a proxy in front of server-test, so they stay out
 * of playwright.config.ts, whose every test runs once per protocol driver.
 */
export default defineConfig({
  testDir: './smoke',
  testMatch: '**/*.test.ts',
  reporter: 'list',
  workers: 1,
  timeout: 120_000,
});
