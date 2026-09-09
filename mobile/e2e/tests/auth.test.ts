import { element, by, expect, waitFor } from 'detox';
import {
  generateTestUser,
  waitForElement,
  gotoLogin,
  gotoRegister,
  launchLoggedOut,
  returnToLoggedOut,
} from '../config/testSetup';
import { requestLimits } from '../../src/types/apiLimits.generated';

describe('Authentication', () => {
  beforeAll(async () => {
    await launchLoggedOut();
  });

  // Not a bare reloadReactNative(). Several tests below sign in, and the
  // session they leave behind lives in the keychain, which a reload does not
  // touch -- so every later test in this file would start on the dashboard and
  // never find the Welcome screen it is looking for (habitcraft-bqhe.7).
  beforeEach(async () => {
    await returnToLoggedOut();
  });

  describe('Welcome screen', () => {
    it('should be the first thing a new user sees', async () => {
      await waitForElement('welcome-screen');
      await expect(element(by.id('welcome-signup-button'))).toBeVisible();
      await expect(element(by.id('welcome-login-button'))).toBeVisible();
    });
  });

  describe('Registration Flow', () => {
    it('should register a new user successfully', async () => {
      const testUser = generateTestUser();

      await gotoRegister();

      await element(by.id('register-name-input')).replaceText(testUser.name);
      await element(by.id('register-email-input')).replaceText(testUser.email);
      await element(by.id('register-password-input')).replaceText(testUser.password);

      await element(by.id('register-button')).tap();

      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should reveal the password on request', async () => {
      // The reveal toggle is what replaced the Confirm Password field.
      await gotoRegister();

      await element(by.id('register-password-input')).replaceText('password123');
      await element(by.id('register-password-input-reveal')).tap();

      await expect(element(by.id('register-password-input'))).toHaveText('password123');
    });

    it('should show a missing name under the name field', async () => {
      await gotoRegister();

      await element(by.id('register-email-input')).replaceText('test@example.com');
      await element(by.id('register-password-input')).replaceText('password123');
      await element(by.id('register-button')).tap();

      await expect(element(by.id('register-name-input-error'))).toBeVisible();
      await expect(element(by.id('register-name-input-error'))).toHaveText('Name is required');
    });

    it('should show an invalid email under the email field', async () => {
      await gotoRegister();

      await element(by.id('register-name-input')).replaceText('Test User');
      await element(by.id('register-email-input')).replaceText('invalid-email');
      await element(by.id('register-password-input')).replaceText('password123');
      await element(by.id('register-button')).tap();

      await expect(element(by.id('register-email-input-error'))).toBeVisible();
      await expect(element(by.id('register-email-input-error'))).toHaveText(
        'Please enter a valid email'
      );
    });

    it('should show a short password under the password field', async () => {
      // 'short' is 5 characters, under the 8 openapi.yaml declares
      // (habitcraft-h7q7).
      await gotoRegister();

      await element(by.id('register-name-input')).replaceText('Test User');
      await element(by.id('register-email-input')).replaceText('test@example.com');
      await element(by.id('register-password-input')).replaceText('short');
      await element(by.id('register-button')).tap();

      await expect(element(by.id('register-password-input-error'))).toBeVisible();
      await expect(element(by.id('register-password-input-error'))).toHaveText(
        `Password must be at least ${requestLimits.register.password.minLength} characters`
      );
    });

    it('should report every failure at once, not one per submit', async () => {
      await gotoRegister();

      await element(by.id('register-button')).tap();

      await expect(element(by.id('register-name-input-error'))).toBeVisible();
      await expect(element(by.id('register-email-input-error'))).toBeVisible();
      await expect(element(by.id('register-password-input-error'))).toBeVisible();
    });

    it('should offer a way to log in when the email is already registered', async () => {
      // The server owns this answer, so it is only reachable end to end. Before
      // habitcraft-tvro.1 this said "Request failed with status code 409".
      const testUser = generateTestUser();

      await gotoRegister();
      await element(by.id('register-name-input')).replaceText(testUser.name);
      await element(by.id('register-email-input')).replaceText(testUser.email);
      await element(by.id('register-password-input')).replaceText(testUser.password);
      await element(by.id('register-button')).tap();
      await waitForElement('dashboard-screen');

      // Same address, second time around. Getting back to the register form
      // means dropping the session the successful registration just created.
      await returnToLoggedOut();
      await gotoRegister();
      await element(by.id('register-name-input')).replaceText(testUser.name);
      await element(by.id('register-email-input')).replaceText(testUser.email);
      await element(by.id('register-password-input')).replaceText(testUser.password);
      await element(by.id('register-button')).tap();

      await waitFor(element(by.id('register-login-instead')))
        .toBeVisible()
        .withTimeout(10000);

      // ...and it carries the email across, so the login form is ready to use.
      await element(by.id('register-login-instead')).tap();
      await expect(element(by.id('login-email-input'))).toHaveText(testUser.email);
    });

    it('should navigate to the login screen', async () => {
      await gotoRegister();

      await element(by.id('register-login-link')).tap();

      await expect(element(by.id('login-button'))).toBeVisible();
    });
  });

  describe('Login Flow', () => {
    it('should login with valid credentials', async () => {
      const testUser = generateTestUser();

      await gotoRegister();
      await element(by.id('register-name-input')).replaceText(testUser.name);
      await element(by.id('register-email-input')).replaceText(testUser.email);
      await element(by.id('register-password-input')).replaceText(testUser.password);
      await element(by.id('register-button')).tap();
      await waitForElement('dashboard-screen');

      await element(by.id('tab-profile')).tap();
      await waitForElement('profile-screen');
      await element(by.id('logout-button')).tap();
      await waitForElement('welcome-screen');

      await gotoLogin();
      await element(by.id('login-email-input')).replaceText(testUser.email);
      await element(by.id('login-password-input')).replaceText(testUser.password);
      await element(by.id('login-button')).tap();

      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show error for invalid credentials', async () => {
      await gotoLogin();

      await element(by.id('login-email-input')).replaceText('nonexistent@example.com');
      await element(by.id('login-password-input')).replaceText('wrongpassword');
      await element(by.id('login-button')).tap();

      await waitFor(element(by.id('login-error')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show a missing email under the email field', async () => {
      await gotoLogin();

      await element(by.id('login-password-input')).replaceText('password123');
      await element(by.id('login-button')).tap();

      await expect(element(by.id('login-email-input-error'))).toBeVisible();
      await expect(element(by.id('login-email-input-error'))).toHaveText('Email is required');
    });

    it('should show a missing password under the password field', async () => {
      await gotoLogin();

      await element(by.id('login-email-input')).replaceText('test@example.com');
      await element(by.id('login-button')).tap();

      await expect(element(by.id('login-password-input-error'))).toBeVisible();
      await expect(element(by.id('login-password-input-error'))).toHaveText('Password is required');
    });

    it('should show an invalid email under the email field', async () => {
      await gotoLogin();

      await element(by.id('login-email-input')).replaceText('invalid-email');
      await element(by.id('login-password-input')).replaceText('password123');
      await element(by.id('login-button')).tap();

      await expect(element(by.id('login-email-input-error'))).toBeVisible();
      await expect(element(by.id('login-email-input-error'))).toHaveText(
        'Please enter a valid email'
      );
    });
  });
});
