import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * GCP Auth Setup
 *
 * This setup project runs before all GCP smoke tests.
 * It creates a unique test user and saves the authenticated state
 * so subsequent tests can reuse it without logging in each time.
 *
 * This avoids hitting rate limits from multiple login attempts.
 */

// Auth state file - shared with tests via environment
const AUTH_STATE_DIR = path.join(__dirname, '.auth');
export const AUTH_STATE_PATH = path.join(AUTH_STATE_DIR, 'gcp-user.json');
export const TEST_USER_PATH = path.join(AUTH_STATE_DIR, 'gcp-test-user.json');

// Generate unique test user credentials
const TEST_RUN_ID = Date.now();
export const GCP_TEST_USER = {
  email: `gcp-smoke-${TEST_RUN_ID}@example.com`,
  password: 'TestPass123!',
  name: 'GCP Smoke Test User',
};

setup('create test user and authenticate', async ({ page }) => {
  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_STATE_DIR)) {
    fs.mkdirSync(AUTH_STATE_DIR, { recursive: true });
  }

  // Save test user credentials so teardown can access them
  fs.writeFileSync(TEST_USER_PATH, JSON.stringify(GCP_TEST_USER, null, 2));

  console.log(`\n📝 Creating test user: ${GCP_TEST_USER.email}`);

  // Register the test user
  await page.goto('/register');

  await page.getByLabel(/name/i).fill(GCP_TEST_USER.name);
  await page.getByLabel(/email/i).fill(GCP_TEST_USER.email);
  await page.getByLabel(/^password$/i).fill(GCP_TEST_USER.password);
  await page.getByLabel(/confirm password/i).fill(GCP_TEST_USER.password);
  await page.getByRole('button', { name: /sign up/i }).click();

  // Should redirect to dashboard after successful registration
  await expect(page).toHaveURL('/dashboard');

  console.log('✅ User created and logged in');

  // Save the authenticated state for reuse by other tests
  await page.context().storageState({ path: AUTH_STATE_PATH });

  console.log(`✅ Auth state saved to ${AUTH_STATE_PATH}\n`);
});
