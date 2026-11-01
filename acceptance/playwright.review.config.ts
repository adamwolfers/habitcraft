import { defineConfig } from '@playwright/test';

/**
 * The review page generator's own tests (review/, habitcraft-ser3). Plain unit
 * tests: no browser, no system under test, so they stay out of
 * playwright.config.ts, whose every test runs once per protocol driver.
 */
export default defineConfig({
  testDir: './review',
  testMatch: '**/*.test.ts',
  reporter: 'list',
});
