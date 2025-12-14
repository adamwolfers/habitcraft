import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Test credentials (from test-fixtures.sql):
 * - User 1: test@example.com / Test1234!
 * - User 2: test2@example.com / Test1234!
 *
 * Test isolation strategy:
 * - User 1: READ ONLY - never modified, used for login/logout/validation tests
 * - User 2: Never logged in as, only used for "email taken" validation
 * - Data-modifying tests (profile updates) create unique users via registration
 */

test.describe('Authentication', () => {
  test.describe('Login Flow', () => {
    test('should display login page', async ({ page }) => {
      await page.goto('/login');

      // Verify login form is displayed
      await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      await page.goto('/login');

      // Fill in credentials
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('Test1234!');

      // Submit the form
      await page.getByRole('button', { name: /log in/i }).click();

      // Should redirect to home page with habits
      await expect(page).toHaveURL('/');

      // Should see the habit list (test user has habits from fixtures)
      await expect(page.getByText('Morning Exercise')).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto('/login');

      // Fill in wrong credentials
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');

      // Submit the form
      await page.getByRole('button', { name: /log in/i }).click();

      // Should show error message
      await expect(page.getByText(/invalid/i)).toBeVisible();

      // Should stay on login page
      await expect(page).toHaveURL('/login');
    });

    test('should redirect to login when accessing protected route without auth', async ({ page }) => {
      // Try to access home page without being logged in
      await page.goto('/');

      // Should be redirected to login
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Logout Flow', () => {
    test('should logout successfully', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for redirect to home page
      await expect(page).toHaveURL('/');

      // Click logout button
      await page.getByRole('button', { name: /log out/i }).click();

      // Should be redirected to login page
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Registration Flow', () => {
    test('should display registration page', async ({ page }) => {
      await page.goto('/register');

      // Verify registration form is displayed
      await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/^password$/i)).toBeVisible();
      await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    });

    test('should register new user successfully', async ({ page }) => {
      await page.goto('/register');

      // Generate unique email to avoid conflicts
      const uniqueEmail = `e2e-test-${Date.now()}@example.com`;

      // Fill in registration form
      await page.getByLabel(/name/i).fill('E2E Test User');
      await page.getByLabel(/email/i).fill(uniqueEmail);
      await page.getByLabel(/^password$/i).fill('Test1234!');
      await page.getByLabel(/confirm password/i).fill('Test1234!');

      // Submit the form
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should redirect to home page
      await expect(page).toHaveURL('/');
    });

    test('should show error for duplicate email', async ({ page }) => {
      await page.goto('/register');

      // Try to register with existing email
      await page.getByLabel(/name/i).fill('Duplicate User');
      await page.getByLabel(/email/i).fill('test@example.com'); // Already exists
      await page.getByLabel(/^password$/i).fill('Test1234!');
      await page.getByLabel(/confirm password/i).fill('Test1234!');

      // Submit the form
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should show error about duplicate email
      await expect(page.getByText(/email already exists/i)).toBeVisible();
    });
  });

  test.describe('User Isolation', () => {
    test('should only see own habits after login', async ({ page }) => {
      // Login as user 1
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL('/');

      // Should see user 1's habits
      await expect(page.getByText('Morning Exercise')).toBeVisible();
      await expect(page.getByText('Read Books')).toBeVisible();

      // Should NOT see user 2's habits
      await expect(page.getByText('User 2 Habit')).not.toBeVisible();
    });
  });

  test.describe('Profile Management', () => {
    /**
     * Tests that modify user data create their own unique users to ensure
     * test isolation - we don't modify fixture data that other tests depend on.
     */
    test('should update user name', async ({ page }) => {
      // Create a unique user for this test (to avoid modifying fixture users)
      const uniqueEmail = `name-update-test-${Date.now()}@example.com`;
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Original Name');
      await page.getByLabel(/email/i).fill(uniqueEmail);
      await page.getByLabel(/^password$/i).fill('Test1234!');
      await page.getByLabel(/confirm password/i).fill('Test1234!');
      await page.getByRole('button', { name: /sign up/i }).click();

      // Wait for home page
      await expect(page).toHaveURL('/');

      // Click edit name button
      await page.getByRole('button', { name: /edit name/i }).click();

      // Should see name input field
      const nameInput = page.getByRole('textbox', { name: /name/i });
      await expect(nameInput).toBeVisible();

      // Clear and type new name
      await nameInput.clear();
      await nameInput.fill('Updated Name');

      // Click save
      await page.getByRole('button', { name: /save/i }).click();

      // Should exit edit mode and show updated name
      await expect(nameInput).not.toBeVisible();
      // Use .first() since name appears in both inline display and profile button
      await expect(page.getByText('Updated Name').first()).toBeVisible();
    });

    test('should cancel name edit without saving', async ({ page }) => {
      // Login as test user 1 (safe since we don't save changes)
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for home page
      await expect(page).toHaveURL('/');

      // Get original name from the header
      const originalName = await page.locator('header').getByText(/test user/i).first().textContent();

      // Click edit name button
      await page.getByRole('button', { name: /edit name/i }).click();

      // Change the name
      const nameInput = page.getByRole('textbox', { name: /name/i });
      await nameInput.clear();
      await nameInput.fill('Should Not Save');

      // Click cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Should exit edit mode and show original name
      await expect(nameInput).not.toBeVisible();
      // Use .first() since name appears in both inline display and profile button
      await expect(page.locator('header').getByText(originalName!).first()).toBeVisible();
    });

    test('should update user email', async ({ page }) => {
      // Create a unique user for this test (to avoid modifying fixture users)
      const originalEmail = `email-update-test-${Date.now()}@example.com`;
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Email Update Test User');
      await page.getByLabel(/email/i).fill(originalEmail);
      await page.getByLabel(/^password$/i).fill('Test1234!');
      await page.getByLabel(/confirm password/i).fill('Test1234!');
      await page.getByRole('button', { name: /sign up/i }).click();

      // Wait for home page
      await expect(page).toHaveURL('/');

      // Verify original email is displayed
      await expect(page.locator('header').getByText(originalEmail)).toBeVisible();

      // Click edit email button
      await page.getByRole('button', { name: /edit email/i }).click();

      // Should see email input field
      const emailInput = page.getByRole('textbox', { name: /email/i });
      await expect(emailInput).toBeVisible();

      // Clear and type new email (unique to avoid conflicts)
      const newEmail = `updated-e2e-${Date.now()}@example.com`;
      await emailInput.clear();
      await emailInput.fill(newEmail);

      // Click save
      await page.getByRole('button', { name: /save/i }).click();

      // Should exit edit mode and show updated email
      await expect(emailInput).not.toBeVisible();
      await expect(page.locator('header').getByText(newEmail)).toBeVisible();
    });

    test('should cancel email edit without saving', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for home page
      await expect(page).toHaveURL('/');

      // Click edit email button
      await page.getByRole('button', { name: /edit email/i }).click();

      // Change the email
      const emailInput = page.getByRole('textbox', { name: /email/i });
      await emailInput.clear();
      await emailInput.fill('should-not-save@example.com');

      // Click cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Should exit edit mode and NOT show the unsaved email
      await expect(emailInput).not.toBeVisible();
      await expect(page.locator('header').getByText('should-not-save@example.com')).not.toBeVisible();
    });

    test('should show error when email is already taken', async ({ page }) => {
      // Create a new unique user for this test (to ensure independence from other tests)
      const uniqueEmail = `taken-test-${Date.now()}@example.com`;
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Taken Test User');
      await page.getByLabel(/email/i).fill(uniqueEmail);
      await page.getByLabel(/^password$/i).fill('Test1234!');
      await page.getByLabel(/confirm password/i).fill('Test1234!');
      await page.getByRole('button', { name: /sign up/i }).click();

      // Wait for home page
      await expect(page).toHaveURL('/');

      // Click edit email button
      await page.getByRole('button', { name: /edit email/i }).click();

      // Try to change to user 1's email (test@example.com - guaranteed to exist)
      const emailInput = page.getByRole('textbox', { name: /email/i });
      await emailInput.clear();
      await emailInput.fill('test@example.com');

      // Click save
      await page.getByRole('button', { name: /save/i }).click();

      // Should show error message
      await expect(page.getByText(/already in use/i)).toBeVisible();
    });
  });

  test.describe('Profile Modal', () => {
    /**
     * Read-only tests use test user 1 (test@example.com).
     * These tests don't modify data, so they're safe to run with the shared beforeEach.
     */
    test.beforeEach(async ({ page }) => {
      // Login as test user 1
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();
      await expect(page).toHaveURL('/');
    });

    test('should open profile modal when clicking profile button', async ({ page }) => {
      // Click the profile button in header
      await page.getByRole('button', { name: /profile/i }).click();

      // Modal should be visible
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
    });

    test('should display current user info in modal', async ({ page }) => {
      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();

      // Should display user's name and email
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByText(/test user/i)).toBeVisible();
      await expect(page.getByRole('dialog').getByText('test@example.com')).toBeVisible();
    });

    test('should close modal when clicking cancel button', async ({ page }) => {
      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click cancel button
      await page.getByRole('button', { name: /cancel/i }).click();

      // Modal should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should close modal when clicking close (X) button', async ({ page }) => {
      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click close button
      await page.getByRole('button', { name: /close/i }).click();

      // Modal should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should close modal when clicking outside (backdrop)', async ({ page }) => {
      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click on backdrop (outside the dialog content)
      await page.getByTestId('modal-backdrop').click({ position: { x: 10, y: 10 } });

      // Modal should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should cancel profile changes without saving', async ({ page }) => {
      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Modify name
      const nameInput = page.getByRole('dialog').getByLabel(/name/i);
      await nameInput.clear();
      await nameInput.fill('Should Not Save');

      // Cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Modal should close and changes should not be saved
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.locator('header').getByText('Should Not Save')).not.toBeVisible();
    });

    test('should show validation error for invalid email', async ({ page }) => {
      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Enter invalid email
      const emailInput = page.getByRole('dialog').getByLabel(/email/i);
      await emailInput.clear();
      await emailInput.fill('invalid-email');

      // Save button should be disabled or show validation error
      const saveButton = page.getByRole('dialog').getByRole('button', { name: /save/i });
      await expect(saveButton).toBeDisabled();
    });

    test('should show error when email is already taken', async ({ page }) => {
      // Uses beforeEach login as user 1
      // Safe to use test2@example.com since no other test modifies user 2 now

      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Try to change to user 2's email (test2@example.com - guaranteed to exist)
      const emailInput = page.getByRole('dialog').getByLabel(/email/i);
      await emailInput.clear();
      await emailInput.fill('test2@example.com');

      // Save
      await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();

      // Should show error
      await expect(page.getByRole('dialog').getByText(/already in use/i)).toBeVisible();

      // Modal should still be open
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });

  test.describe('Profile Modal Updates', () => {
    /**
     * Tests that modify user data create their own unique users to ensure
     * test isolation - we don't modify fixture data that other tests depend on.
     */
    test('should update user name from profile modal', async ({ page }) => {
      // Create a unique user for this test
      const uniqueEmail = `modal-name-update-${Date.now()}@example.com`;
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Original Modal Name');
      await page.getByLabel(/email/i).fill(uniqueEmail);
      await page.getByLabel(/^password$/i).fill('Test1234!');
      await page.getByLabel(/confirm password/i).fill('Test1234!');
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page).toHaveURL('/');

      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Clear and update name
      const nameInput = page.getByRole('dialog').getByLabel(/name/i);
      await nameInput.clear();
      await nameInput.fill('Updated Via Modal');

      // Save changes
      await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Name should be updated in header (check the profile button)
      await expect(page.getByRole('button', { name: /profile/i })).toHaveText('Updated Via Modal');

      // Verify persistence after reload
      await page.reload();
      await expect(page.getByRole('button', { name: /profile/i })).toHaveText('Updated Via Modal');
    });

    test('should update user email from profile modal', async ({ page }) => {
      // Create a unique user for this test
      const originalEmail = `modal-email-update-${Date.now()}@example.com`;
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Email Modal Test User');
      await page.getByLabel(/email/i).fill(originalEmail);
      await page.getByLabel(/^password$/i).fill('Test1234!');
      await page.getByLabel(/confirm password/i).fill('Test1234!');
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page).toHaveURL('/');

      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Clear and update email (unique to avoid conflicts)
      const newEmail = `modal-updated-${Date.now()}@example.com`;
      const emailInput = page.getByRole('dialog').getByLabel(/email/i);
      await emailInput.clear();
      await emailInput.fill(newEmail);

      // Save changes
      await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Email should be updated in header
      await expect(page.locator('header').getByText(newEmail)).toBeVisible();
    });
  });

  test.describe('Token Refresh', () => {
    test('should refresh token automatically when access token expires', async ({ page, context }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for home page with habits
      await expect(page).toHaveURL('/');
      await expect(page.getByText('Morning Exercise')).toBeVisible();

      // Simulate access token expiration by clearing only the access token cookie
      // The refresh token remains intact
      const cookies = await context.cookies();
      const refreshToken = cookies.find(c => c.name === 'refreshToken');

      // Clear all cookies and restore only the refresh token
      await context.clearCookies();
      if (refreshToken) {
        await context.addCookies([refreshToken]);
      }

      // Trigger an API request by reloading the page
      // This should: 1) Get 401, 2) Refresh token, 3) Retry and succeed
      await page.reload();

      // User should still be logged in and see their habits
      // (If refresh failed, they would be redirected to /login)
      await expect(page).toHaveURL('/');
      await expect(page.getByText('Morning Exercise')).toBeVisible();
    });

    test('should redirect to login when refresh token is also expired', async ({ page, context }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for home page
      await expect(page).toHaveURL('/');
      await expect(page.getByText('Morning Exercise')).toBeVisible();

      // Clear ALL cookies (both access and refresh tokens)
      await context.clearCookies();

      // Try to reload - should redirect to login since no valid tokens
      await page.reload();

      // Should be redirected to login page
      await expect(page).toHaveURL('/login');
    });
  });
});
