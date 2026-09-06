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
 * Login with test credentials
 */
export async function loginTestUser(email: string, password: string) {
  await element(by.id('login-email-input')).typeText(email);
  await element(by.id('login-password-input')).typeText(password);
  await element(by.id('login-button')).tap();
  await waitForElement('dashboard-screen');
}

/**
 * Register a new test user
 */
export async function registerTestUser(user: ReturnType<typeof generateTestUser>) {
  await element(by.id('login-signup-link')).tap();
  await waitForElement('register-email-input');

  await element(by.id('register-name-input')).typeText(user.name);
  await element(by.id('register-email-input')).typeText(user.email);
  await element(by.id('register-password-input')).typeText(user.password);
  await element(by.id('register-confirm-password-input')).typeText(user.password);
  await element(by.id('register-button')).tap();
  await waitForElement('dashboard-screen');
}

/**
 * Logout the current user
 */
export async function logoutUser() {
  await element(by.text('Profile')).tap();
  await waitForElement('profile-screen');
  await element(by.id('logout-button')).tap();
  await waitForElement('login-button');
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
