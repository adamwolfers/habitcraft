import { test, expect } from '@playwright/test';

/**
 * GCP Smoke Tests
 *
 * These tests validate core functionality against the deployed GCP environment.
 * Tests are fully self-sufficient - they create their own test user during setup
 * and clean up after themselves by deleting the test user.
 *
 * Each test run creates a unique user to avoid conflicts.
 */

// Generate unique test user for this test run
const TEST_RUN_ID = Date.now();
const GCP_TEST_USER = {
  email: `gcp-smoke-${TEST_RUN_ID}@example.com`,
  password: 'TestPass123!',
  name: 'GCP Smoke Test User',
};

// Track whether user was created (for cleanup)
let testUserCreated = false;

test.describe('GCP Smoke Tests', () => {
  // Cleanup: Delete test user after all tests complete
  test.afterAll(async ({ request }) => {
    if (!testUserCreated) {
      console.log('Test user was not created, skipping cleanup');
      return;
    }

    try {
      // Login to get auth cookies
      const loginResponse = await request.post('/api/v1/auth/login', {
        data: {
          email: GCP_TEST_USER.email,
          password: GCP_TEST_USER.password,
        },
      });

      if (!loginResponse.ok()) {
        console.log('Could not login for cleanup - user may already be deleted');
        return;
      }

      // Delete the test user (requires password confirmation)
      const deleteResponse = await request.delete('/api/v1/users/me', {
        data: {
          password: GCP_TEST_USER.password,
        },
      });

      if (deleteResponse.status() === 204) {
        console.log(`Cleaned up test user: ${GCP_TEST_USER.email}`);
      } else {
        console.log(`Failed to delete test user: ${deleteResponse.status()}`);
      }
    } catch (error) {
      console.log('Error during cleanup:', error);
    }
  });

  // Setup: Create test user before running authenticated tests
  test.describe('Setup', () => {
    test('should create test user for this test run', async ({ page }) => {
      await page.goto('/register');

      await page.getByLabel(/name/i).fill(GCP_TEST_USER.name);
      await page.getByLabel(/email/i).fill(GCP_TEST_USER.email);
      await page.getByLabel(/^password$/i).fill(GCP_TEST_USER.password);
      await page.getByLabel(/confirm password/i).fill(GCP_TEST_USER.password);
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should redirect to dashboard after registration
      await expect(page).toHaveURL('/dashboard');

      // Mark user as created for cleanup
      testUserCreated = true;

      // Logout so subsequent tests start fresh
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /log out/i }).click();
      await expect(page).toHaveURL('/login');
    });
  });

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

  test.describe('Authentication', () => {
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

    test('should login successfully with GCP test user', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill(GCP_TEST_USER.email);
      await page.locator('#password').fill(GCP_TEST_USER.password);
      await page.getByRole('button', { name: /log in/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard');
    });

    test('should logout successfully', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(GCP_TEST_USER.email);
      await page.locator('#password').fill(GCP_TEST_USER.password);
      await page.getByRole('button', { name: /log in/i }).click();
      await expect(page).toHaveURL('/dashboard');

      // Logout via profile menu
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /log out/i }).click();

      // Should be on login page
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Dashboard & Habits', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(GCP_TEST_USER.email);
      await page.locator('#password').fill(GCP_TEST_USER.password);
      await page.getByRole('button', { name: /log in/i }).click();
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

      // Find today's date button and click it to mark complete
      // The buttons are labeled like "Mon 13", "Tue 14", etc.
      const today = new Date();
      const dayAbbrev = today.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = today.getDate().toString();

      // Click the button for today's date
      await page.getByRole('button', { name: new RegExp(`${dayAbbrev}.*${dayNum}`, 'i') }).click();

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

      // Click the delete button on the habit card
      await page.getByRole('button', { name: /delete habit/i }).click();

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
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(GCP_TEST_USER.email);
      await page.locator('#password').fill(GCP_TEST_USER.password);
      await page.getByRole('button', { name: /log in/i }).click();
      await expect(page).toHaveURL('/dashboard');
    });

    test('should open profile menu', async ({ page }) => {
      // Click the profile button in the header
      await page.getByRole('button', { name: /profile/i }).click();

      // Should see profile menu options
      await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
    });
  });

  test.describe('Registration', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');

      await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });
  });
});
