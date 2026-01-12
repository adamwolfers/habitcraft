import { test, expect } from '@playwright/test';

/**
 * GCP Smoke Tests
 *
 * These tests validate core functionality against the deployed GCP environment.
 * Tests are fully self-sufficient - they create their own test user during setup,
 * so they work regardless of database contents (e.g., after data migration).
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

// Track if user has been created
let userCreated = false;

test.describe('GCP Smoke Tests', () => {
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
      userCreated = true;

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

      // Logout
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
      // Dashboard should be visible
      await expect(page.getByRole('heading', { name: /habits/i })).toBeVisible();
    });

    test('should create a new habit', async ({ page }) => {
      // Generate unique habit name to avoid conflicts
      const habitName = `GCP Test Habit ${Date.now()}`;

      // Click add habit button
      await page.getByRole('button', { name: /add habit/i }).click();

      // Fill in habit form
      await page.getByLabel(/name/i).fill(habitName);
      await page.getByLabel(/description/i).fill('Created by E2E smoke test');

      // Submit
      await page.getByRole('button', { name: /save|create/i }).click();

      // Should see the new habit in the list
      await expect(page.getByText(habitName)).toBeVisible();
    });

    test('should mark a habit as complete', async ({ page }) => {
      // First create a habit to complete
      const habitName = `Complete Test ${Date.now()}`;

      await page.getByRole('button', { name: /add habit/i }).click();
      await page.getByLabel(/name/i).fill(habitName);
      await page.getByRole('button', { name: /save|create/i }).click();
      await expect(page.getByText(habitName)).toBeVisible();

      // Find the habit card and click the complete button/checkbox
      const habitCard = page.locator('[data-testid="habit-card"]', { hasText: habitName });

      // Click the completion checkbox/button for today
      // The exact selector depends on your UI implementation
      const todayButton = habitCard.getByRole('button').first();
      await todayButton.click();

      // Verify completion is recorded (button state should change)
      // This might show a checkmark or change color
      await expect(todayButton).toHaveAttribute('data-completed', 'true');
    });

    test('should delete a habit', async ({ page }) => {
      // First create a habit to delete
      const habitName = `Delete Test ${Date.now()}`;

      await page.getByRole('button', { name: /add habit/i }).click();
      await page.getByLabel(/name/i).fill(habitName);
      await page.getByRole('button', { name: /save|create/i }).click();
      await expect(page.getByText(habitName)).toBeVisible();

      // Find and click edit/delete on the habit
      const habitCard = page.locator('[data-testid="habit-card"]', { hasText: habitName });
      await habitCard.getByRole('button', { name: /edit|options|menu/i }).click();
      await page.getByRole('button', { name: /delete/i }).click();

      // Confirm deletion if there's a confirmation dialog
      const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmButton.isVisible()) {
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

    test('should open profile modal', async ({ page }) => {
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();

      // Modal should be visible with user info
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByText(GCP_TEST_USER.email)).toBeVisible();
    });

    test('should close profile modal', async ({ page }) => {
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Close modal
      await page.getByRole('button', { name: /cancel|close/i }).first().click();

      // Modal should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Registration', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');

      await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });

    test('should show error for duplicate email', async ({ page }) => {
      await page.goto('/register');

      // Try to register with existing test user email
      await page.getByLabel(/name/i).fill('Duplicate Test');
      await page.getByLabel(/email/i).fill(GCP_TEST_USER.email);
      await page.getByLabel(/^password$/i).fill('Test1234!');
      await page.getByLabel(/confirm password/i).fill('Test1234!');
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should show error about duplicate email
      await expect(page.getByText(/already exists|already in use/i)).toBeVisible();
    });

    test('should register a new unique user', async ({ page }) => {
      await page.goto('/register');

      // Use unique email
      const uniqueEmail = `gcp-e2e-${Date.now()}@example.com`;

      await page.getByLabel(/name/i).fill('GCP E2E New User');
      await page.getByLabel(/email/i).fill(uniqueEmail);
      await page.getByLabel(/^password$/i).fill('Test1234!');
      await page.getByLabel(/confirm password/i).fill('Test1234!');
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard');
    });
  });
});
