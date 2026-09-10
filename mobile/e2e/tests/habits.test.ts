import { device, element, by, expect, waitFor } from 'detox';
import {
  generateTestUser,
  launchAuthenticated,
  waitForElement,
  createHabit,
  habitCard,
  habitCardMatcher,
  returnToDashboard,
} from '../config/testSetup';

describe('Habit CRUD Operations', () => {
  const testUser = generateTestUser();

  beforeAll(async () => {
    // Signed in via injected tokens rather than the registration form: iOS
    // answers any credential submit with its AutoFill prompt, which Detox
    // cannot dismiss (habitcraft-bqhe.11).
    await launchAuthenticated(testUser);
  });

  // Put the app back on the dashboard rather than checking that it happens to
  // be there. Waiting alone made every test after the first a casualty of the
  // one before it: the validation test below leaves the create-habit modal
  // open, the dashboard is behind it, and the remaining ten tests all failed
  // on a dashboard timeout that said nothing about what they were testing
  // (habitcraft-bqhe.14).
  beforeEach(async () => {
    await returnToDashboard();
  });

  // FIRST, AND IT HAS TO BE. Every other describe below leaves habits behind,
  // and this account is generated per run, so the only moment the empty state
  // is real is before the first create. The version this replaces had no body
  // at all -- just a comment saying a fresh user would see the empty state --
  // so it passed against any app whatsoever (habitcraft-bqhe.9).
  //
  // RNTL covers the empty state too, but only from mocked props. This is the
  // one that says a new account really comes back from the API with no habits.
  describe('Empty State', () => {
    it('should show the empty state before any habit exists @smoke', async () => {
      await expect(element(by.id('empty-state'))).toBeVisible();
      await expect(element(by.id('habit-card'))).not.toExist();
    });
  });

  describe('Create Habit', () => {
    it('should create a new habit successfully @smoke', async () => {
      const habitName = 'Morning Exercise';
      const habitDescription = '30 minutes of cardio';

      // Tap FAB to create new habit
      await element(by.id('create-habit-fab')).tap();
      await waitForElement('habit-name-input');

      // Fill habit form
      await element(by.id('habit-name-input')).replaceText(habitName);
      await element(by.id('habit-description-input')).replaceText(habitDescription);

      // Submit form
      await element(by.id('create-habit-button')).tap();

      // Verify back on dashboard
      await waitForElement('dashboard-screen');

      // Verify habit appears in list
      await expect(habitCard(habitName)).toBeVisible();
    });

    it('should show error when creating habit without name', async () => {
      // Tap FAB to create new habit
      await element(by.id('create-habit-fab')).tap();
      await waitForElement('habit-name-input');

      // Try to submit without name
      await element(by.id('create-habit-button')).tap();

      // Verify error is shown
      await expect(element(by.id('create-habit-error'))).toBeVisible();
      await expect(element(by.id('create-habit-error'))).toHaveText('Habit name is required');
    });

    it('should create habit with only name (description optional)', async () => {
      const habitName = 'Read Books';

      await element(by.id('create-habit-fab')).tap();
      await waitForElement('habit-name-input');

      // Fill only name
      await element(by.id('habit-name-input')).replaceText(habitName);

      // Submit form
      await element(by.id('create-habit-button')).tap();

      // Verify back on dashboard with habit visible
      await waitForElement('dashboard-screen');
      await expect(habitCard(habitName)).toBeVisible();
    });
  });

  describe('Read Habits', () => {
    it('should display habits in the list', async () => {
      // Verify habit list is visible
      await expect(element(by.id('habit-list'))).toBeVisible();

      // Verify at least one habit card is visible (from previous tests)
      await expect(element(by.id('habit-card')).atIndex(0)).toBeVisible();
    });

    // NO PULL-TO-REFRESH SPEC HERE, deliberately. The one that used to sit at
    // this point called element(by.id('habit-list')).scroll(200, 'down'), which
    // is not the pull gesture and failed with 'Unable to scroll down in '. It
    // left the RefreshControl mid-gesture and the run loop permanently awake,
    // so every later test in this file failed on a 30s timeout that had nothing
    // to do with its subject -- and a reload did not clear it. Its only
    // assertion was that habit-list was still visible, which holds whether or
    // not a refresh happened, so nothing was lost by removing it.
    //
    // The behaviour itself is pinned by RNTL in DashboardScreen.test.tsx, which
    // drives refreshControl.onRefresh directly and asserts the spinner both
    // opens for an explicit pull and stays shut for a background refetch --
    // the distinction habitcraft-wut established (habitcraft-bqhe.9).
  });

  describe('Update Habit', () => {
    it('should edit an existing habit @smoke', async () => {
      // First create a habit to edit
      const originalName = 'Habit to Edit';
      const updatedName = 'Updated Habit Name';

      await createHabit(originalName);
      await waitForElement('dashboard-screen');

      // Tap on the habit to view details, then edit from there. The card
      // opens HabitDetailScreen, not the edit form; only the detail screen's
      // edit button reaches EditHabitScreen, which owns save-habit-button
      // (habitcraft-bqhe.15).
      await habitCard(originalName).tap();
      await waitForElement('edit-habit-button');
      await element(by.id('edit-habit-button')).tap();
      await waitForElement('save-habit-button');

      // replaceText() sets the field outright, so no clearText() first.
      await element(by.id('edit-habit-name-input')).replaceText(updatedName);

      // Save changes
      await element(by.id('save-habit-button')).tap();

      // Saving goes back one screen, to the detail screen the edit was opened
      // from -- not to the dashboard. Wait for that, so a save that silently
      // failed and left the form up is still a failure here.
      await waitForElement('edit-habit-button');

      // Reload to the dashboard rather than tapping back. It refetches, so the
      // renamed card proves the update reached the server rather than only the
      // local cache (habitcraft-bqhe.15).
      await returnToDashboard();
      await expect(habitCard(updatedName)).toBeVisible();
    });
  });

  describe('Delete Habit', () => {
    it('should delete a habit with confirmation @smoke', async () => {
      // First create a habit to delete
      const habitName = 'Habit to Delete';

      await createHabit(habitName);
      await waitForElement('dashboard-screen');

      // Verify habit exists
      await expect(habitCard(habitName)).toBeVisible();

      // Tap on the habit to open edit screen
      await habitCard(habitName).tap();
      await waitForElement('delete-habit-button');

      // Tap delete button
      await element(by.id('delete-habit-button')).tap();

      // Confirm deletion in alert
      await element(by.text('Delete')).tap();

      // Verify back on dashboard and habit is gone
      await waitForElement('dashboard-screen');
      await expect(habitCard(habitName)).not.toBeVisible();
    });

    it('should cancel deletion when dismissed', async () => {
      // Create a habit
      const habitName = 'Habit Not Deleted';

      await createHabit(habitName);
      await waitForElement('dashboard-screen');

      // Open edit screen
      await habitCard(habitName).tap();
      await waitForElement('delete-habit-button');

      // Tap delete button
      await element(by.id('delete-habit-button')).tap();

      // Cancel deletion
      await element(by.text('Cancel')).tap();

      // Go back to dashboard
      await device.pressBack();
      await waitForElement('dashboard-screen');

      // Verify habit still exists
      await expect(habitCard(habitName)).toBeVisible();
    });
  });

  describe('Complete Habit', () => {
    // habit-completed-check renders only for a habit completed today, so its
    // presence IS the completion state. The two specs this replaces tapped
    // complete-button and then asserted complete-button was still visible,
    // which holds for a completely broken toggle (habitcraft-bqhe.9).
    //
    // Both matchers are scoped to one named card rather than atIndex(0), and
    // each spec creates the habit it drives. So neither depends on how many
    // habits the file made before it, on where the list puts a new one, or on
    // what the other spec left behind -- and both run in isolation.
    const completeButtonFor = (name: string) =>
      element(by.id('complete-button').withAncestor(habitCardMatcher(name)));
    const checkFor = (name: string) =>
      element(by.id('habit-completed-check').withAncestor(habitCardMatcher(name)));

    it('should mark a habit as complete for today @smoke', async () => {
      const habitName = 'Habit to Complete';
      await createHabit(habitName);

      await expect(checkFor(habitName)).not.toExist();

      await completeButtonFor(habitName).tap();

      await waitFor(checkFor(habitName)).toBeVisible().withTimeout(10000);
    });

    it('should toggle completion status', async () => {
      const habitName = 'Habit to Toggle';
      await createHabit(habitName);

      // Complete ...
      await completeButtonFor(habitName).tap();
      await waitFor(checkFor(habitName)).toBeVisible().withTimeout(10000);

      // ... and uncomplete, which is the half a single tap cannot show.
      await completeButtonFor(habitName).tap();
      await waitFor(checkFor(habitName)).not.toExist().withTimeout(10000);
    });
  });
});
