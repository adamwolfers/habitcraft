import { device, element, by, expect, waitFor } from 'detox';
import {
  createUserViaApi,
  generateTestUser,
  loginTestUser,
  logoutUser,
  relaunchAuthenticated,
  relaunchWithoutSeeding,
  waitForElement,
  type E2ESession,
} from '../config/testSetup';

describe('Logout', () => {
  const testUser = generateTestUser();
  let session: E2ESession;

  beforeAll(async () => {
    // The session is obtained over HTTP rather than through the login form:
    // iOS answers any credential submit with its AutoFill prompt, which Detox
    // cannot dismiss (habitcraft-bqhe.11). Created once, because registering
    // the same address twice is a 409.
    session = await createUserViaApi(testUser);
  });

  // Every test in this file starts signed in on the dashboard because this hook
  // makes it so, not because the previous test happened to leave it that way.
  // A reload would not be enough here: most of these tests log out, and the
  // session is seeded from launch arguments at process start, so getting it
  // back means a fresh launch.
  //
  // The tests below also stopped tapping the Profile tab by its label. Test 1
  // used to leave the app on Profile, and test 2's by.text('Profile') then
  // matched both the tab and the screen's own heading -- six of seven tests in
  // this file failed on that cascade (habitcraft-bqhe.14).
  beforeEach(async () => {
    await relaunchAuthenticated(session);
  });

  describe('Logout Flow', () => {
    it('should navigate to profile screen from dashboard', async () => {
      await element(by.id('tab-profile')).tap();

      await waitFor(element(by.id('profile-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should display user email on profile screen', async () => {
      await element(by.id('tab-profile')).tap();
      await waitForElement('profile-screen');

      await expect(element(by.id('profile-email'))).toBeVisible();
      await expect(element(by.id('profile-email'))).toHaveText(testUser.email);
    });

    it('should logout and return to the welcome screen @smoke', async () => {
      await element(by.id('tab-profile')).tap();
      await waitForElement('profile-screen');

      await element(by.id('logout-button')).tap();

      // Welcome is the auth stack's initial route, so that is where logging out
      // lands -- not the login form.
      await waitFor(element(by.id('welcome-screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('welcome-signup-button'))).toBeVisible();
      await expect(element(by.id('welcome-login-button'))).toBeVisible();
    });

    it('should require login after logout @smoke', async () => {
      await logoutUser();

      // Back in the auth stack...
      await expect(element(by.id('welcome-screen'))).toBeVisible();

      // ...and the dashboard is gone with it.
      await expect(element(by.id('dashboard-screen'))).not.toBeVisible();
    });

    it('should allow login again after logout', async () => {
      await logoutUser();

      await loginTestUser(testUser.email, testUser.password);

      await waitForElement('dashboard-screen');
    });
  });

  // These three are the only specs in the suite whose subject is the stored
  // session itself, so they are the only ones that must not be handed one.
  // Every launch here carries no seeding arguments, and the reload relies on
  // the app seeding once per launch (habitcraft-bqhe.16) -- without that, the
  // session came back whatever the test had just done to it.
  describe('Session Persistence', () => {
    it('should not restore the session on a reload after logout', async () => {
      await logoutUser();

      await device.reloadReactNative();

      await expect(element(by.id('welcome-screen'))).toBeVisible();
    });

    it('should not restore the session on a restart after logout', async () => {
      await logoutUser();

      await relaunchWithoutSeeding();

      await waitForElement('welcome-screen', 30000);
    });

    it('should persist the session across a restart when logged in', async () => {
      await relaunchWithoutSeeding();

      await waitForElement('dashboard-screen', 30000);
    });
  });
});
