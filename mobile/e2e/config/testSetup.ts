import { device, element, by, waitFor } from 'detox';

// Value entry here is replaceText(), never typeText(). typeText() delivers one
// keystroke at a time and does not reliably land a full string in a
// secureTextEntry field -- a 16-character password arrived as 7 or fewer, so
// the form rejected itself before any request was sent (habitcraft-bqhe.6).
// replaceText() sets the field atomically and is proven against the real app.
// An eslint rule keeps typeText() out of e2e/; a test that genuinely needs
// incremental typing must disable it explicitly and say why.

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
 * Create a user over HTTP and return the tokens the app needs to be signed in.
 *
 * The suite does not register through the UI, because iOS answers any
 * successful credential submit with its AutoFill "Save Password?" prompt, which
 * Detox can neither see nor dismiss (habitcraft-bqhe.11).
 */
export async function createUserViaApi(user: ReturnType<typeof generateTestUser>): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const response = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: user.name, email: user.email, password: user.password }),
  });

  if (response.status !== 201) {
    // Say which backend was asked and what it said. The usual cause is no
    // backend on API_URL at all, which otherwise surfaces much later as an
    // unexplained wait timing out on the dashboard.
    const body = await response.text();
    throw new Error(
      `Could not create an E2E user via ${API_URL}: HTTP ${response.status} ${body.slice(0, 200)}`
    );
  }

  const body = (await response.json()) as { accessToken?: string; refreshToken?: string };
  if (!body.accessToken || !body.refreshToken) {
    throw new Error('Register returned no tokens; the response shape has changed');
  }

  return { accessToken: body.accessToken, refreshToken: body.refreshToken };
}

/**
 * Launch the app already signed in as a freshly created user.
 *
 * This is how every spec should authenticate. The tokens travel as Detox launch
 * arguments and the app seeds its secure store from them at startup
 * (src/lib/e2eSession.ts), so no password is ever typed and the AutoFill prompt
 * is never offered.
 */
export async function launchAuthenticated(
  user: ReturnType<typeof generateTestUser> = generateTestUser()
): Promise<ReturnType<typeof generateTestUser>> {
  const tokens = await createUserViaApi(user);

  await device.launchApp({
    delete: true,
    newInstance: true,
    launchArgs: {
      e2eAccessToken: tokens.accessToken,
      e2eRefreshToken: tokens.refreshToken,
    },
  });

  await waitForElement('dashboard-screen', 30000);
  return user;
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
  await element(by.id('login-email-input')).replaceText(email);
  await element(by.id('login-password-input')).replaceText(password);
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

  await element(by.id('register-name-input')).replaceText(user.name);
  await element(by.id('register-email-input')).replaceText(user.email);
  await element(by.id('register-password-input')).replaceText(user.password);
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

  await element(by.id('habit-name-input')).replaceText(name);
  if (description) {
    await element(by.id('habit-description-input')).replaceText(description);
  }
  await element(by.id('create-habit-button')).tap();
  await waitForElement('dashboard-screen');
}
