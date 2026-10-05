import { expect as jestExpect } from '@jest/globals';
import { element, by, expect, waitFor } from 'detox';
import {
  E2ESession,
  canToggleConnectivity,
  createHabit,
  fetchHabitsViaApi,
  generateTestUser,
  habitCard,
  habitCardMatcher,
  launchAuthenticated,
  returnToDashboard,
  setDeviceOnline,
  waitForElement,
  waitForElementToDisappear,
} from '../config/testSetup';

// Offline means the DEVICE has no network, because that is what the app reads
// (NetInfo). This file used to fake it with device.setURLBlacklist(), which
// NetInfo never sees, so no case in it could pass (habitcraft-bqhe.10).
// setDeviceOnline() switches the emulator's Wi-Fi and mobile data off, which
// only Android can do; on iOS the file is skipped, and reported as skipped,
// rather than run against a network it cannot take away.
const describeWithConnectivity = canToggleConnectivity() ? describe : describe.skip;

// How long NetInfo may take to notice. Losing the network is quick; getting it
// back waits on Android revalidating the connection before NetInfo calls the
// internet reachable again.
const GOES_OFFLINE_MS = 15000;
const COMES_BACK_MS = 30000;

async function goOffline(): Promise<void> {
  setDeviceOnline(false);
  await waitForElement('offline-banner', GOES_OFFLINE_MS);
}

async function goOnline(): Promise<void> {
  setDeviceOnline(true);
  await waitForElementToDisappear('offline-banner', COMES_BACK_MS);
}

function pendingBadgeOn(habitName: string) {
  return element(by.id('pending-badge').withAncestor(habitCardMatcher(habitName)));
}

// Matched on the indicator's accessibility label, which states the count. A
// by.text('1 pending') scoped to the indicator found nothing on Android while
// the badge was plainly on screen: the indicator is an accessible element with
// its own label, so its text is not reachable as a separate descendant.
async function waitForPendingCount(count: number): Promise<void> {
  const label = `${count} ${count === 1 ? 'change' : 'changes'} pending sync`;
  await waitFor(element(by.id('sync-indicator').and(by.label(label))))
    .toBeVisible()
    .withTimeout(5000);
}

// Detox's expect asserts on the screen; jestExpect asserts on what the backend
// holds, which is the only proof a queued change actually synced.
async function serverHabitNamed(session: E2ESession, name: string) {
  return (await fetchHabitsViaApi(session)).find((habit) => habit.name === name);
}

describeWithConnectivity('Offline Functionality', () => {
  let session: E2ESession;

  beforeAll(async () => {
    // A run that died mid-test can leave the emulator offline, and
    // launchAuthenticated() needs the network to create its user.
    setDeviceOnline(true);
    ({ session } = await launchAuthenticated(generateTestUser()));
  });

  beforeEach(async () => {
    await returnToDashboard();
  });

  // Every case takes the network away, and a failure partway through must not
  // strand the next one -- or the next file -- offline.
  afterEach(() => {
    setDeviceOnline(true);
  });

  describe('Offline Banner', () => {
    it('should show the offline banner when the device loses its network', async () => {
      await goOffline();

      await expect(element(by.text("You're offline"))).toBeVisible();
    });

    it('should hide the offline banner when the network comes back', async () => {
      await goOffline();

      await goOnline();

      await expect(element(by.id('offline-banner'))).not.toExist();
    });
  });

  // Each case queues its change AND syncs it. The version this replaces split
  // queueing and syncing into separate tests that relied on running in order,
  // so one failure took its neighbour down with it (habitcraft-bqhe.14).
  describe('Offline Mutations', () => {
    it('should queue a habit created offline and sync it on reconnect', async () => {
      const habitName = 'Offline Created Habit';

      await goOffline();
      await createHabit(habitName);

      await expect(habitCard(habitName)).toBeVisible();
      await expect(pendingBadgeOn(habitName)).toBeVisible();
      await waitForPendingCount(1);
      jestExpect(await serverHabitNamed(session, habitName)).toBeUndefined();

      await goOnline();

      await waitFor(pendingBadgeOn(habitName)).not.toExist().withTimeout(COMES_BACK_MS);
      await waitFor(element(by.id('sync-indicator')))
        .not.toExist()
        .withTimeout(COMES_BACK_MS);
      await expect(habitCard(habitName)).toBeVisible();
      jestExpect(await serverHabitNamed(session, habitName)).toBeDefined();
    });

    it('should queue a completion made offline and sync it on reconnect', async () => {
      const habitName = 'Offline Completed Habit';
      await createHabit(habitName);
      const created = await serverHabitNamed(session, habitName);
      jestExpect(created?.completions).toEqual([]);

      await goOffline();
      await element(by.id('complete-button').withAncestor(habitCardMatcher(habitName))).tap();

      await waitForPendingCount(1);

      await goOnline();

      await waitFor(element(by.id('sync-indicator')))
        .not.toExist()
        .withTimeout(COMES_BACK_MS);
      jestExpect((await serverHabitNamed(session, habitName))?.completions).toHaveLength(1);
    });
  });

  describe('Sync Indicator', () => {
    it('should count every change queued while offline', async () => {
      await goOffline();
      await createHabit('Queued Habit 1');
      await createHabit('Queued Habit 2');

      await waitForPendingCount(2);

      await goOnline();

      await waitFor(element(by.id('sync-indicator')))
        .not.toExist()
        .withTimeout(COMES_BACK_MS);
    });
  });
});
