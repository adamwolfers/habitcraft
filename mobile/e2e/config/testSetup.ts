import { execFileSync } from 'child_process';
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
 * Clear the session that survives everything the app itself can do.
 *
 * expo-secure-store keeps its items in the iOS keychain, which is not part of
 * the app container. So the session outlives reloadReactNative(), a
 * launchApp({ newInstance: true }), and even launchApp({ delete: true }) --
 * that last one uninstalls and reinstalls the app and still comes up
 * authenticated (habitcraft-bqhe.7, confirmed by probe). `simctl keychain
 * reset` is the cheapest thing that does clear it; `simctl erase` also works
 * but wipes the whole device.
 *
 * ANDROID IS A DELIBERATE NO-OP. There the tokens live in app data, which a
 * reinstall clears, so launchApp({ delete: true }) already yields a logged-out
 * app and there is nothing to reset. The CI target for this epic is Android,
 * so this guard is the common path there, not an edge case.
 *
 * FAILS LOUDLY. An unreported reset failure is the worst shape this can take:
 * the whole suite then runs against a surviving session and every logged-out
 * assertion fails somewhere far away from the cause. That exact mistake cost
 * 36 of 38 tests in scripts/prepare-ios-simulator.sh before the error was
 * unsuppressed.
 */
export function clearDeviceSession(): void {
  if (device.getPlatform() !== 'ios') {
    return;
  }

  try {
    execFileSync('xcrun', ['simctl', 'keychain', device.id, 'reset'], { stdio: 'pipe' });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not clear the keychain on simulator ${device.id}, so the app would ` +
        `start from the previous spec's session: ${detail}`
    );
  }
}

/**
 * Launch the app with no session at all, on the Welcome screen.
 *
 * Welcome is the auth stack's initial route, so this is what "logged out" looks
 * like -- not the login form, which is a screen further in.
 */
export async function launchLoggedOut(): Promise<void> {
  clearDeviceSession();
  await device.launchApp({ delete: true, newInstance: true });
  await waitForElement('welcome-screen', 30000);
}

/**
 * Return an already-running app to the logged-out state, between tests.
 *
 * Cheaper than launchLoggedOut(): reloading the JS bundle remounts
 * AuthProvider, whose mount effect re-reads storage.hasTokens(), so clearing
 * the keychain first is enough to make it come up signed out. Use this in a
 * beforeEach; use launchLoggedOut() for the first launch in a file.
 */
export async function returnToLoggedOut(): Promise<void> {
  clearDeviceSession();
  await device.reloadReactNative();
  await waitForElement('welcome-screen', 30000);
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

  // Even though the launch arguments overwrite whatever tokens are already
  // there, clear first: a spec that reaches this with a stale session and a
  // seeding failure would silently test the previous user's account instead of
  // failing (habitcraft-bqhe.7).
  clearDeviceSession();

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
