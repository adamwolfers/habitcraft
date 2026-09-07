import { element, by, waitFor } from 'detox';

// API base URL for test backend
export const API_URL = process.env.E2E_API_URL || 'http://localhost:3010';

/**
 * Generate a unique test user for E2E tests
 */
export function generateTestUser() {
  const timestamp = Date.now();
  return {
    // name is required -- users.name is NOT NULL and the register body must
    // carry it (habitcraft-7ggs).
    name: 'E2E Test User',
    email: `e2e-test-${timestamp}@habitcraft.test`,
    password: 'TestPassword123!',
  };
}

/**
 * Wait for an element to be visible with timeout
 */
export async function waitForElement(testID: string, timeout = 10000) {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait for an element to not be visible
 */
export async function waitForElementToDisappear(testID: string, timeout = 10000) {
  await waitFor(element(by.id(testID)))
    .not.toBeVisible()
    .withTimeout(timeout);
}

/**
 * Open the login form.
 *
 * Welcome is the auth stack's initial route, so neither form is on screen when
 * the app launches -- every auth spec starts by choosing one.
 */
export async function gotoLogin() {
  await waitForElement('welcome-screen');
  await element(by.id('welcome-login-button')).tap();
  await waitForElement('login-email-input');
}

/**
 * Open the registration form.
 */
export async function gotoRegister() {
  await waitForElement('welcome-screen');
  await element(by.id('welcome-signup-button')).tap();
  await waitForElement('register-email-input');
}

/**
 * Login with test credentials
 */
export async function loginTestUser(email: string, password: string) {
  await gotoLogin();
  await element(by.id('login-email-input')).typeText(email);
  await element(by.id('login-password-input')).typeText(password);
  await element(by.id('login-button')).tap();
  await waitForElement('dashboard-screen');
}

/**
 * Register a new test user.
 *
 * Three fields, not four: the Confirm Password field was replaced by a reveal
 * toggle on the password itself.
 */
export async function registerTestUser(user: ReturnType<typeof generateTestUser>) {
  await gotoRegister();

  await element(by.id('register-name-input')).typeText(user.name);
  await element(by.id('register-email-input')).typeText(user.email);
  await element(by.id('register-password-input')).typeText(user.password);
  await element(by.id('register-button')).tap();
  await waitForElement('dashboard-screen');
}

/**
 * Logout the current user.
 *
 * Logging out returns to Welcome, the auth stack's initial route -- not
 * straight to the login form.
 */
export async function logoutUser() {
  await element(by.text('Profile')).tap();
  await waitForElement('profile-screen');
  await element(by.id('logout-button')).tap();
  await waitForElement('welcome-screen');
}

/**
 * Create a habit from the dashboard
 */
export async function createHabit(name: string, description?: string) {
  await element(by.id('create-habit-fab')).tap();
  await waitForElement('habit-name-input');

  await element(by.id('habit-name-input')).typeText(name);
  if (description) {
    await element(by.id('habit-description-input')).typeText(description);
  }
  await element(by.id('create-habit-button')).tap();
  await waitForElement('dashboard-screen');
}
