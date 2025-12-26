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
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
    });

    test('should toggle password visibility on login page', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.locator('#password');
      const toggleButton = page.getByRole('button', { name: /show password/i });

      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password');
      await expect(toggleButton).toBeVisible();

      // Type a password
      await passwordInput.fill('mySecretPassword');

      // Click toggle to show password
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
      await expect(page.getByRole('button', { name: /hide password/i })).toBeVisible();

      // Click toggle to hide password again
      await page.getByRole('button', { name: /hide password/i }).click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      await page.goto('/login');

      // Fill in credentials
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.locator('#password').fill('Test1234!');

      // Submit the form
      await page.getByRole('button', { name: /log in/i }).click();

      // Should redirect to dashboard with habits
      await expect(page).toHaveURL('/dashboard');

      // Should see the habit list (test user has habits from fixtures)
      await expect(page.getByText('Morning Exercise')).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto('/login');

      // Fill in wrong credentials
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.locator('#password').fill('wrongpassword');

      // Submit the form
      await page.getByRole('button', { name: /log in/i }).click();

      // Should show error message
      await expect(page.getByText(/invalid/i)).toBeVisible();

      // Should stay on login page
      await expect(page).toHaveURL('/login');
    });

    test('should redirect to login when accessing protected route without auth', async ({ page }) => {
      // Try to access dashboard without being logged in
      await page.goto('/dashboard');

      // Should be redirected to login
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Logout Flow', () => {
    test('should logout successfully', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.locator('#password').fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for redirect to home page
      await expect(page).toHaveURL('/dashboard');

      // Open profile menu and click logout
      await page.getByRole('button', { name: /profile/i }).click();
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

    test('should toggle password visibility on registration page', async ({ page }) => {
      await page.goto('/register');

      const passwordInput = page.getByLabel(/^password$/i);
      const confirmPasswordInput = page.getByLabel(/confirm password/i);

      // Get both toggle buttons (there should be 2)
      const toggleButtons = page.getByRole('button', { name: /show password/i });
      await expect(toggleButtons).toHaveCount(2);

      // Both inputs should start as password type
      await expect(passwordInput).toHaveAttribute('type', 'password');
      await expect(confirmPasswordInput).toHaveAttribute('type', 'password');

      // Toggle first password field
      await toggleButtons.first().click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
      await expect(confirmPasswordInput).toHaveAttribute('type', 'password');

      // Toggle confirm password field
      await page.getByRole('button', { name: /show password/i }).click();
      await expect(confirmPasswordInput).toHaveAttribute('type', 'text');
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
      await expect(page).toHaveURL('/dashboard');
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
    test('should only see own habits after login as user 1', async ({ page }) => {
      // Login as user 1
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.locator('#password').fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL('/dashboard');

      // Should see user 1's habits
      await expect(page.getByText('Morning Exercise')).toBeVisible();
      await expect(page.getByText('Read Books')).toBeVisible();

      // Should NOT see user 2's habits
      await expect(page.getByText('User 2 Habit')).not.toBeVisible();
    });

    test('should only see own habits after login as user 2', async ({ page }) => {
      // Login as user 2
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test2@example.com');
      await page.locator('#password').fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL('/dashboard');

      // Should see user 2's habit
      await expect(page.getByText('User 2 Habit')).toBeVisible();

      // Should NOT see user 1's habits
      await expect(page.getByText('Morning Exercise')).not.toBeVisible();
      await expect(page.getByText('Read Books')).not.toBeVisible();
    });

    test('should not leak data between user sessions', async ({ page }) => {
      // Login as user 1
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.locator('#password').fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL('/dashboard');
      await expect(page.getByText('Morning Exercise')).toBeVisible();

      // Logout via profile menu
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /log out/i }).click();
      await expect(page).toHaveURL('/login');

      // Login as user 2
      await page.getByLabel(/email/i).fill('test2@example.com');
      await page.locator('#password').fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL('/dashboard');

      // Should see only user 2's data (no cached user 1 data)
      await expect(page.getByText('User 2 Habit')).toBeVisible();
      await expect(page.getByText('Morning Exercise')).not.toBeVisible();
      await expect(page.getByText('Read Books')).not.toBeVisible();
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
      await page.locator('#password').fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();
      await expect(page).toHaveURL('/dashboard');
    });

    test('should open profile modal when clicking Edit Profile in menu', async ({ page }) => {
      // Click the profile button to open menu
      await page.getByRole('button', { name: /profile/i }).click();

      // Click Edit Profile in the menu
      await page.getByRole('button', { name: /edit profile/i }).click();

      // Modal should be visible
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
    });

    test('should display current user info in modal', async ({ page }) => {
      // Open profile menu and click Edit Profile
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();

      // Should display user's name and email
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByText(/test user/i)).toBeVisible();
      await expect(page.getByRole('dialog').getByText('test@example.com')).toBeVisible();
    });

    test('should close modal when clicking cancel button', async ({ page }) => {
      // Open profile menu and click Edit Profile
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click cancel button
      await page.getByRole('button', { name: /cancel/i }).click();

      // Modal should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should close modal when clicking close (X) button', async ({ page }) => {
      // Open profile menu and click Edit Profile
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click close button
      await page.getByRole('button', { name: /close/i }).click();

      // Modal should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should NOT close modal when clicking outside (backdrop)', async ({ page }) => {
      // Open profile menu and click Edit Profile
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click on backdrop (outside the dialog content)
      await page.getByTestId('modal-backdrop').click({ position: { x: 10, y: 10 } });

      // Modal should remain open (clicking outside does not close it)
      await expect(page.getByRole('dialog')).toBeVisible();

      // Close modal using Cancel button to clean up
      await page.getByRole('button', { name: /cancel/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should cancel profile changes without saving', async ({ page }) => {
      // Open profile menu and click Edit Profile
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
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
      // Open profile menu and click Edit Profile
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
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

      // Open profile menu and click Edit Profile
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
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
      await expect(page).toHaveURL('/dashboard');

      // Open profile menu and click Edit Profile
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Clear and update name
      const nameInput = page.getByRole('dialog').getByLabel(/name/i);
      await nameInput.clear();
      await nameInput.fill('Updated Via Modal');

      // Save changes
      await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Verify name was updated by reopening profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog').getByLabel(/name/i)).toHaveValue('Updated Via Modal');
      await page.getByRole('dialog').getByRole('button', { name: /cancel/i }).click();

      // Verify persistence after reload
      await page.reload();
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog').getByLabel(/name/i)).toHaveValue('Updated Via Modal');
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
      await expect(page).toHaveURL('/dashboard');

      // Open profile menu and click Edit Profile
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
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

      // Email should be updated - verify by reopening profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog').getByLabel(/email/i)).toHaveValue(newEmail);
    });
  });

  test.describe('Token Refresh', () => {
    test('should refresh token automatically when access token expires', async ({ page, context }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.locator('#password').fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for home page with habits
      await expect(page).toHaveURL('/dashboard');
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
      await expect(page).toHaveURL('/dashboard');
      await expect(page.getByText('Morning Exercise')).toBeVisible();
    });

    test('should redirect to login when refresh token is also expired', async ({ page, context }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.locator('#password').fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for home page
      await expect(page).toHaveURL('/dashboard');
      await expect(page.getByText('Morning Exercise')).toBeVisible();

      // Clear ALL cookies (both access and refresh tokens)
      await context.clearCookies();

      // Try to reload - should redirect to login since no valid tokens
      await page.reload();

      // Should be redirected to login page
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Password Change', () => {
    /**
     * Password change tests create unique users to ensure test isolation.
     * Each test registers a fresh user so we can safely modify their password.
     */

    test('should toggle password visibility in password change form', async ({ page }) => {
      // Login as test user
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.locator('#password').fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();
      await expect(page).toHaveURL('/dashboard');

      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Get password inputs in the change password section
      const currentPasswordInput = page.getByLabel(/current password/i);
      const newPasswordInput = page.getByLabel(/^new password$/i);
      const confirmPasswordInput = page.getByLabel(/confirm.*password/i);

      // Get toggle buttons (should be 3 in the password change section)
      const toggleButtons = page.getByRole('dialog').getByRole('button', { name: /show password/i });
      await expect(toggleButtons).toHaveCount(3);

      // All should start hidden
      await expect(currentPasswordInput).toHaveAttribute('type', 'password');
      await expect(newPasswordInput).toHaveAttribute('type', 'password');
      await expect(confirmPasswordInput).toHaveAttribute('type', 'password');

      // Toggle current password visibility
      await toggleButtons.first().click();
      await expect(currentPasswordInput).toHaveAttribute('type', 'text');
      await expect(newPasswordInput).toHaveAttribute('type', 'password');
      await expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    test('should change password successfully', async ({ page }) => {
      const uniqueId = Date.now();
      const email = `pwchange-${uniqueId}@example.com`;
      const originalPassword = 'Original123!';
      const newPassword = 'NewPass456!';

      // Register a new user
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Password Test User');
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password$/i).fill(originalPassword);
      await page.getByLabel(/confirm password/i).fill(originalPassword);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page).toHaveURL('/dashboard');

      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Fill in password change fields
      await page.getByLabel(/current password/i).fill(originalPassword);
      await page.getByLabel(/^new password$/i).fill(newPassword);
      await page.getByLabel(/confirm.*password/i).fill(newPassword);

      // Submit password change
      await page.getByRole('button', { name: /^change password$/i }).click();

      // Fields should be cleared on success
      await expect(page.getByLabel(/current password/i)).toHaveValue('');
      await expect(page.getByLabel(/^new password$/i)).toHaveValue('');
      await expect(page.getByLabel(/confirm.*password/i)).toHaveValue('');
    });

    test('should show error for wrong current password', async ({ page }) => {
      const uniqueId = Date.now();
      const email = `pwwrong-${uniqueId}@example.com`;
      const originalPassword = 'Original123!';

      // Register a new user
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Wrong Password Test');
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password$/i).fill(originalPassword);
      await page.getByLabel(/confirm password/i).fill(originalPassword);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page).toHaveURL('/dashboard');

      // Open profile modal
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Fill in password change with wrong current password
      await page.getByLabel(/current password/i).fill('WrongPassword123!');
      await page.getByLabel(/^new password$/i).fill('NewPass456!');
      await page.getByLabel(/confirm.*password/i).fill('NewPass456!');

      // Submit password change
      await page.getByRole('button', { name: /^change password$/i }).click();

      // Should show error for invalid current password
      await expect(page.getByText(/invalid current password/i)).toBeVisible();
    });

    test('should login with new password after change', async ({ page }) => {
      const uniqueId = Date.now();
      const email = `pwlogin-${uniqueId}@example.com`;
      const originalPassword = 'Original123!';
      const newPassword = 'NewPass456!';

      // Register a new user
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Login After Change Test');
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password$/i).fill(originalPassword);
      await page.getByLabel(/confirm password/i).fill(originalPassword);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page).toHaveURL('/dashboard');

      // Open profile modal and change password
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await page.getByLabel(/current password/i).fill(originalPassword);
      await page.getByLabel(/^new password$/i).fill(newPassword);
      await page.getByLabel(/confirm.*password/i).fill(newPassword);
      await page.getByRole('button', { name: /^change password$/i }).click();

      // Wait for success (fields cleared)
      await expect(page.getByLabel(/current password/i)).toHaveValue('');

      // Close modal and logout
      await page.getByRole('button', { name: /cancel/i }).click();
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /log out/i }).click();
      await expect(page).toHaveURL('/login');

      // Login with new password
      await page.getByLabel(/email/i).fill(email);
      await page.locator('#password').fill(newPassword);
      await page.getByRole('button', { name: /log in/i }).click();

      // Should successfully login
      await expect(page).toHaveURL('/dashboard');
    });

    test('should reject old password after change', async ({ page }) => {
      const uniqueId = Date.now();
      const email = `pwreject-${uniqueId}@example.com`;
      const originalPassword = 'Original123!';
      const newPassword = 'NewPass456!';

      // Register a new user
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Reject Old Password Test');
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password$/i).fill(originalPassword);
      await page.getByLabel(/confirm password/i).fill(originalPassword);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page).toHaveURL('/dashboard');

      // Open profile modal and change password
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /edit profile/i }).click();
      await page.getByLabel(/current password/i).fill(originalPassword);
      await page.getByLabel(/^new password$/i).fill(newPassword);
      await page.getByLabel(/confirm.*password/i).fill(newPassword);
      await page.getByRole('button', { name: /^change password$/i }).click();

      // Wait for success
      await expect(page.getByLabel(/current password/i)).toHaveValue('');

      // Close modal and logout
      await page.getByRole('button', { name: /cancel/i }).click();
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /log out/i }).click();
      await expect(page).toHaveURL('/login');

      // Try to login with old password
      await page.getByLabel(/email/i).fill(email);
      await page.locator('#password').fill(originalPassword);
      await page.getByRole('button', { name: /log in/i }).click();

      // Should fail to login
      await expect(page.getByText(/invalid/i)).toBeVisible();
      await expect(page).toHaveURL('/login');
    });
  });
});
