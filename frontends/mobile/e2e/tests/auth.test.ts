import { device, element, by, expect, waitFor } from 'detox';
import { generateTestUser, waitForElement } from '../config/testSetup';

describe('Authentication', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Registration Flow', () => {
    it('should register a new user successfully', async () => {
      const testUser = generateTestUser();

      // Navigate to register screen
      await element(by.id('login-signup-link')).tap();
      await waitForElement('register-email-input');

      // Fill registration form
      await element(by.id('register-email-input')).typeText(testUser.email);
      await element(by.id('register-password-input')).typeText(testUser.password);
      await element(by.id('register-confirm-password-input')).typeText(
        testUser.password
      );

      // Submit form
      await element(by.id('register-button')).tap();

      // Verify navigation to dashboard
      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show error for mismatched passwords', async () => {
      // Navigate to register screen
      await element(by.id('login-signup-link')).tap();
      await waitForElement('register-email-input');

      // Fill form with mismatched passwords
      await element(by.id('register-email-input')).typeText(
        'test@example.com'
      );
      await element(by.id('register-password-input')).typeText('password123');
      await element(by.id('register-confirm-password-input')).typeText(
        'different456'
      );

      // Submit form
      await element(by.id('register-button')).tap();

      // Verify error is shown
      await expect(element(by.id('register-error'))).toBeVisible();
      await expect(element(by.id('register-error'))).toHaveText(
        'Passwords do not match'
      );
    });

    it('should show error for invalid email format', async () => {
      // Navigate to register screen
      await element(by.id('login-signup-link')).tap();
      await waitForElement('register-email-input');

      // Fill form with invalid email
      await element(by.id('register-email-input')).typeText('invalid-email');
      await element(by.id('register-password-input')).typeText('password123');
      await element(by.id('register-confirm-password-input')).typeText(
        'password123'
      );

      // Submit form
      await element(by.id('register-button')).tap();

      // Verify error is shown
      await expect(element(by.id('register-error'))).toBeVisible();
      await expect(element(by.id('register-error'))).toHaveText(
        'Please enter a valid email'
      );
    });

    it('should show error for short password', async () => {
      // Navigate to register screen
      await element(by.id('login-signup-link')).tap();
      await waitForElement('register-email-input');

      // Fill form with short password
      await element(by.id('register-email-input')).typeText(
        'test@example.com'
      );
      await element(by.id('register-password-input')).typeText('12345');
      await element(by.id('register-confirm-password-input')).typeText('12345');

      // Submit form
      await element(by.id('register-button')).tap();

      // Verify error is shown
      await expect(element(by.id('register-error'))).toBeVisible();
      await expect(element(by.id('register-error'))).toHaveText(
        'Password must be at least 6 characters'
      );
    });

    it('should navigate back to login screen', async () => {
      // Navigate to register screen
      await element(by.id('login-signup-link')).tap();
      await waitForElement('register-email-input');

      // Tap login link to go back
      await element(by.id('register-login-link')).tap();

      // Verify back on login screen
      await expect(element(by.id('login-button'))).toBeVisible();
    });
  });

  describe('Login Flow', () => {
    it('should login with valid credentials', async () => {
      // First register a user to login with
      const testUser = generateTestUser();

      await element(by.id('login-signup-link')).tap();
      await waitForElement('register-email-input');

      await element(by.id('register-email-input')).typeText(testUser.email);
      await element(by.id('register-password-input')).typeText(testUser.password);
      await element(by.id('register-confirm-password-input')).typeText(
        testUser.password
      );
      await element(by.id('register-button')).tap();
      await waitForElement('dashboard-screen');

      // Logout
      await element(by.text('Profile')).tap();
      await waitForElement('profile-screen');
      await element(by.id('logout-button')).tap();
      await waitForElement('login-button');

      // Now login with the same credentials
      await element(by.id('login-email-input')).typeText(testUser.email);
      await element(by.id('login-password-input')).typeText(testUser.password);
      await element(by.id('login-button')).tap();

      // Verify navigation to dashboard
      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show error for invalid credentials', async () => {
      await element(by.id('login-email-input')).typeText(
        'nonexistent@example.com'
      );
      await element(by.id('login-password-input')).typeText('wrongpassword');
      await element(by.id('login-button')).tap();

      // Verify error is shown
      await waitFor(element(by.id('login-error')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show error for empty email', async () => {
      await element(by.id('login-password-input')).typeText('password123');
      await element(by.id('login-button')).tap();

      // Verify error is shown
      await expect(element(by.id('login-error'))).toBeVisible();
      await expect(element(by.id('login-error'))).toHaveText(
        'Email is required'
      );
    });

    it('should show error for empty password', async () => {
      await element(by.id('login-email-input')).typeText('test@example.com');
      await element(by.id('login-button')).tap();

      // Verify error is shown
      await expect(element(by.id('login-error'))).toBeVisible();
      await expect(element(by.id('login-error'))).toHaveText(
        'Password is required'
      );
    });

    it('should show error for invalid email format', async () => {
      await element(by.id('login-email-input')).typeText('invalid-email');
      await element(by.id('login-password-input')).typeText('password123');
      await element(by.id('login-button')).tap();

      // Verify error is shown
      await expect(element(by.id('login-error'))).toBeVisible();
      await expect(element(by.id('login-error'))).toHaveText(
        'Please enter a valid email'
      );
    });
  });
});
