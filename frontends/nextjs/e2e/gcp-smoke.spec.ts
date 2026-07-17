import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * GCP Smoke Tests
 *
 * These tests validate core functionality against the deployed GCP environment.
 *
 * Architecture:
 * - gcp-auth.setup.ts creates a unique test user before these tests run
 * - Tests run with pre-authenticated state (no login required)
 * - gcp-auth.teardown.ts deletes the test user after tests complete
 *
 * This setup project pattern avoids rate limiting from multiple login attempts.
 */

// Path to test user credentials (created by setup project)
const TEST_USER_PATH = path.join(__dirname, '.auth/gcp-test-user.json');

// Helper to get test user credentials (for tests that explicitly test login)
function getTestUser() {
  if (!fs.existsSync(TEST_USER_PATH)) {
    throw new Error('Test user file not found. Did the setup project run?');
  }
  return JSON.parse(fs.readFileSync(TEST_USER_PATH, 'utf-8'));
}

test.describe('GCP Smoke Tests', () => {
  // Tests that should run without authentication
  test.describe('Unauthenticated', () => {
    // Clear storage state to ensure we're not logged in
    test.use({ storageState: { cookies: [], origins: [] } });

    test.describe('Landing Page', () => {
      test('should load the landing page', async ({ page }) => {
        await page.goto('/');

        // Should see the landing page content
        await expect(page).toHaveTitle(/habitcraft/i);
      });

      test('should navigate to login page', async ({ page }) => {
        await page.goto('/');

        // Click login link/button
        await page.getByRole('link', { name: /log in/i }).click();

        // Should be on login page
        await expect(page).toHaveURL('/login');
        await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();
      });
    });

    test.describe('Authentication Forms', () => {
      test('should display login form', async ({ page }) => {
        await page.goto('/login');

        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.locator('#password')).toBeVisible();
        await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
      });

      test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/login');

        await page.getByLabel(/email/i).fill('invalid@example.com');
        await page.locator('#password').fill('wrongpassword');
        await page.getByRole('button', { name: /log in/i }).click();

        // Should show error
        await expect(page.getByText(/invalid/i)).toBeVisible();
        await expect(page).toHaveURL('/login');
      });

      test('should display registration form', async ({ page }) => {
        await page.goto('/register');

        await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
        await expect(page.getByLabel(/name/i)).toBeVisible();
        await expect(page.getByLabel(/email/i)).toBeVisible();
      });
    });
  });

  test.describe('Authentication Flow', () => {
    // These tests explicitly test login/logout, so use fresh context
    test.use({ storageState: { cookies: [], origins: [] } });

    // Combined login/logout test to minimize rate limit impact
    // Only uses 1 login attempt instead of 2 separate tests
    test('should login and logout successfully with GCP test user', async ({ page }) => {
      const testUser = getTestUser();

      // Test login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(testUser.email);
      await page.locator('#password').fill(testUser.password);
      await page.getByRole('button', { name: /log in/i }).click();

      // Should redirect to dashboard after login
      await expect(page).toHaveURL('/dashboard');

      // Test logout via profile menu
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /log out/i }).click();

      // Should be on login page after logout
      await expect(page).toHaveURL('/login');
    });
  });

  // Tests that use pre-authenticated state from the setup project
  test.describe('Dashboard & Habits', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/dashboard');
    });

    test('should display dashboard after login', async ({ page }) => {
      // Dashboard should be visible - check for Add Habit button which is always present
      await expect(page.getByRole('button', { name: /add.*habit/i })).toBeVisible();
    });

    test('should create a new habit', async ({ page }) => {
      // Generate unique habit name to avoid conflicts
      const habitName = `GCP Test Habit ${Date.now()}`;

      // Click add habit button
      await page.getByRole('button', { name: /add.*habit/i }).click();

      // Fill in habit form
      await page.getByLabel(/name/i).fill(habitName);
      await page.getByLabel(/description/i).fill('Created by E2E smoke test');

      // Submit
      await page.getByRole('button', { name: /save|create|add habit/i }).click();

      // Should see the new habit in the list
      await expect(page.getByText(habitName)).toBeVisible();
    });

    test('should mark a habit as complete', async ({ page }) => {
      // First create a habit to complete
      const habitName = `Complete Test ${Date.now()}`;

      await page.getByRole('button', { name: /add.*habit/i }).click();
      await page.getByLabel(/name/i).fill(habitName);
      await page.getByRole('button', { name: /save|create|add habit/i }).click();
      await expect(page.getByText(habitName)).toBeVisible();

      // Find the habit card by locating the heading with the habit name, then navigating up
      // The habit card is a div with class bg-gray-800, containing an h3 with the habit name
      const habitHeading = page.getByRole('heading', { name: habitName, level: 3 });
      const habitCard = habitHeading.locator(
        'xpath=ancestor::div[contains(@class, "bg-gray-800")]'
      );

      const today = new Date();
      const dayAbbrev = today.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = today.getDate().toString();

      // Click the button for today's date within this habit's card
      await habitCard
        .getByRole('button', { name: new RegExp(`${dayAbbrev}.*${dayNum}`, 'i') })
        .click();

      // Verify the page is still functional after marking complete
      await expect(page.getByText(habitName)).toBeVisible();
    });

    test('should delete a habit', async ({ page }) => {
      // First create a habit to delete
      const habitName = `Delete Test ${Date.now()}`;

      await page.getByRole('button', { name: /add.*habit/i }).click();
      await page.getByLabel(/name/i).fill(habitName);
      await page.getByRole('button', { name: /save|create|add habit/i }).click();
      await expect(page.getByText(habitName)).toBeVisible();

      // Find the habit card by locating the heading with the habit name, then navigating up
      const habitHeading = page.getByRole('heading', { name: habitName, level: 3 });
      const habitCard = habitHeading.locator(
        'xpath=ancestor::div[contains(@class, "bg-gray-800")]'
      );

      await habitCard.getByRole('button', { name: /delete habit/i }).click();

      // Confirm deletion if there's a confirmation dialog
      const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Habit should no longer be visible
      await expect(page.getByText(habitName)).not.toBeVisible();
    });
  });

  test.describe('Profile', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard');
    });

    test('should open profile menu', async ({ page }) => {
      // Click the profile button in the header
      await page.getByRole('button', { name: /profile/i }).click();

      // Should see profile menu options
      await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
    });
  });
});
