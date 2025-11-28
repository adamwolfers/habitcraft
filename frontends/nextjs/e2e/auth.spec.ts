import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Test credentials (from test-fixtures.sql):
 * - User 1: test@example.com / Test1234!
 * - User 2: test2@example.com / Test1234!
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
});
