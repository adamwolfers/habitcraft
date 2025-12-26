import { test, expect } from '@playwright/test';

/**
 * Landing Page E2E Tests
 *
 * Tests for the public landing page functionality and navigation.
 * Focuses on user flows rather than specific copy.
 */

test.describe('Landing Page', () => {
  test.describe('Public Access', () => {
    test('should display landing page with hero section', async ({ page }) => {
      await page.goto('/');

      // Should have a main heading
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('should display header with Login and Sign Up links', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
    });

    test('should navigate to login when clicking Log In', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /log in/i }).click();

      await expect(page).toHaveURL('/login');
    });

    test('should navigate to register when clicking Sign Up', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /sign up/i }).click();

      await expect(page).toHaveURL('/register');
    });

    test('should navigate to register when clicking Get Started CTA', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /get started/i }).first().click();

      await expect(page).toHaveURL('/register');
    });

    test('should display features section with feature cards', async ({ page }) => {
      await page.goto('/');

      // Features section has multiple h3 headings for feature cards
      const featureCards = page.getByRole('heading', { level: 3 });
      await expect(featureCards).toHaveCount(6); // 3 features + 3 how it works steps
    });
  });

  test.describe('Authenticated User', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.locator('#password').fill('Test1234!');
      await page.getByRole('button', { name: /log in/i }).click();
      await expect(page).toHaveURL('/dashboard');
    });

    test('should show Go to Dashboard link when visiting landing page', async ({ page }) => {
      await page.goto('/');

      // Should see Go to Dashboard link instead of Login/Sign Up
      await expect(page.getByRole('link', { name: /go to dashboard/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /log in/i })).not.toBeVisible();
      await expect(page.getByRole('link', { name: /sign up/i })).not.toBeVisible();
    });

    test('should navigate to dashboard when clicking Go to Dashboard', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /go to dashboard/i }).click();

      await expect(page).toHaveURL('/dashboard');
    });

    test('should show profile menu with logout on landing page', async ({ page }) => {
      await page.goto('/');

      // Open profile menu
      await page.getByRole('button', { name: /profile/i }).click();

      // Should see logout in menu
      await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
    });

    test('should logout from landing page via profile menu', async ({ page }) => {
      await page.goto('/');

      // Open profile menu and click logout
      await page.getByRole('button', { name: /profile/i }).click();
      await page.getByRole('button', { name: /log out/i }).click();

      await expect(page).toHaveURL('/login');
    });
  });
});
