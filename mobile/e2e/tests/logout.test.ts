import { device, element, by, expect, waitFor } from 'detox';
import {
  generateTestUser,
  registerTestUser,
  waitForElement,
  loginTestUser,
} from '../config/testSetup';

describe('Logout', () => {
  const testUser = generateTestUser();

  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Register a test user
    await registerTestUser(testUser);
  });

  describe('Logout Flow', () => {
    it('should navigate to profile screen from dashboard', async () => {
      // Ensure we're on the dashboard
      await waitForElement('dashboard-screen');

      // Tap on Profile tab
      await element(by.text('Profile')).tap();

      // Verify profile screen is visible
      await waitFor(element(by.id('profile-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should display user email on profile screen', async () => {
      // Navigate to profile if not already there
      await element(by.text('Profile')).tap();
      await waitForElement('profile-screen');

      // Verify email is displayed
      await expect(element(by.id('profile-email'))).toBeVisible();
      await expect(element(by.id('profile-email'))).toHaveText(testUser.email);
    });

    it('should logout and return to login screen', async () => {
      // Navigate to profile screen
      await element(by.text('Profile')).tap();
      await waitForElement('profile-screen');

      // Tap logout button
      await element(by.id('logout-button')).tap();

      // Verify returned to login screen
      await waitFor(element(by.id('login-button')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify we can see login form elements
      await expect(element(by.id('login-email-input'))).toBeVisible();
      await expect(element(by.id('login-password-input'))).toBeVisible();
    });

    it('should require login after logout', async () => {
      // After logout, trying to access dashboard should not work
      // We should be on login screen
      await expect(element(by.id('login-button'))).toBeVisible();

      // Dashboard should not be visible
      await expect(element(by.id('dashboard-screen'))).not.toBeVisible();
    });

    it('should allow login again after logout', async () => {
      // Login with the same credentials
      await loginTestUser(testUser.email, testUser.password);

      // Verify back on dashboard
      await waitForElement('dashboard-screen');
    });
  });

  describe('Session Persistence', () => {
    it('should clear session data on logout', async () => {
      // Login user
      await waitForElement('dashboard-screen');

      // Logout
      await element(by.text('Profile')).tap();
      await waitForElement('profile-screen');
      await element(by.id('logout-button')).tap();
      await waitForElement('login-button');

      // Restart app
      await device.reloadReactNative();

      // Should still be on login screen (session was cleared)
      await expect(element(by.id('login-button'))).toBeVisible();
    });

    it('should persist session across app restarts when logged in', async () => {
      // Login
      await loginTestUser(testUser.email, testUser.password);
      await waitForElement('dashboard-screen');

      // Restart app
      await device.reloadReactNative();

      // Should still be logged in
      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });
});
