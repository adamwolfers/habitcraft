import { device, element, by, expect, waitFor } from 'detox';
import { generateTestUser, registerTestUser, waitForElement } from '../config/testSetup';

describe('Offline Functionality', () => {
  const testUser = generateTestUser();

  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Register and login a test user
    await registerTestUser(testUser.email, testUser.password);
  });

  beforeEach(async () => {
    // Ensure we're on the dashboard
    await waitForElement('dashboard-screen');
  });

  describe('Offline Banner', () => {
    it('should show offline banner when network is disabled', async () => {
      // Disable network connectivity
      await device.setURLBlacklist(['.*']);

      // Trigger a network check by pulling to refresh
      await element(by.id('habit-list')).scroll(200, 'down');

      // Wait for offline banner to appear
      await waitFor(element(by.id('offline-banner')))
        .toBeVisible()
        .withTimeout(10000);

      // Verify banner content
      await expect(element(by.text("You're offline"))).toBeVisible();

      // Re-enable network
      await device.setURLBlacklist([]);
    });

    it('should hide offline banner when network is restored', async () => {
      // First disable network
      await device.setURLBlacklist(['.*']);

      // Trigger network check
      await element(by.id('habit-list')).scroll(200, 'down');

      // Wait for offline banner
      await waitFor(element(by.id('offline-banner')))
        .toBeVisible()
        .withTimeout(10000);

      // Re-enable network
      await device.setURLBlacklist([]);

      // Pull to refresh to trigger reconnect
      await element(by.id('habit-list')).scroll(200, 'down');

      // Banner should disappear
      await waitFor(element(by.id('offline-banner')))
        .not.toBeVisible()
        .withTimeout(15000);
    });
  });

  describe('Offline Mutations', () => {
    it('should queue habit creation while offline', async () => {
      const habitName = 'Offline Created Habit';

      // Disable network
      await device.setURLBlacklist(['.*']);

      // Create a habit while offline
      await element(by.id('create-habit-fab')).tap();
      await waitForElement('habit-name-input');

      await element(by.id('habit-name-input')).typeText(habitName);
      await element(by.id('create-habit-button')).tap();

      // Verify back on dashboard
      await waitForElement('dashboard-screen');

      // Habit should appear with pending badge
      await expect(element(by.text(habitName))).toBeVisible();
      await expect(element(by.id('pending-badge'))).toBeVisible();

      // Sync indicator should show pending count
      await expect(element(by.id('sync-indicator'))).toBeVisible();

      // Re-enable network
      await device.setURLBlacklist([]);
    });

    it('should sync queued mutations when network is restored', async () => {
      // Assuming we have pending mutations from previous test
      // Re-enable network if not already
      await device.setURLBlacklist([]);

      // Pull to refresh to trigger sync
      await element(by.id('habit-list')).scroll(200, 'down');

      // Wait for sync to complete - pending badge should disappear
      await waitFor(element(by.id('pending-badge')))
        .not.toBeVisible()
        .withTimeout(15000);

      // Sync indicator should also clear
      await waitFor(element(by.id('sync-indicator')))
        .not.toBeVisible()
        .withTimeout(15000);
    });

    it('should queue habit completion while offline', async () => {
      // Disable network
      await device.setURLBlacklist(['.*']);

      // Mark a habit as complete
      await element(by.id('complete-button')).atIndex(0).tap();

      // Sync indicator should show pending count
      await waitFor(element(by.id('sync-indicator')))
        .toBeVisible()
        .withTimeout(5000);

      // Re-enable network and sync
      await device.setURLBlacklist([]);
      await element(by.id('habit-list')).scroll(200, 'down');

      // Wait for sync to complete
      await waitFor(element(by.id('sync-indicator')))
        .not.toBeVisible()
        .withTimeout(15000);
    });
  });

  describe('Sync Indicator', () => {
    it('should show pending count when mutations are queued', async () => {
      // Disable network
      await device.setURLBlacklist(['.*']);

      // Create multiple habits to queue
      await element(by.id('create-habit-fab')).tap();
      await waitForElement('habit-name-input');
      await element(by.id('habit-name-input')).typeText('Queued Habit 1');
      await element(by.id('create-habit-button')).tap();
      await waitForElement('dashboard-screen');

      await element(by.id('create-habit-fab')).tap();
      await waitForElement('habit-name-input');
      await element(by.id('habit-name-input')).typeText('Queued Habit 2');
      await element(by.id('create-habit-button')).tap();
      await waitForElement('dashboard-screen');

      // Sync indicator should show count
      await expect(element(by.id('sync-indicator'))).toBeVisible();

      // Re-enable network
      await device.setURLBlacklist([]);
    });
  });

  afterAll(async () => {
    // Ensure network is re-enabled
    await device.setURLBlacklist([]);
  });
});
