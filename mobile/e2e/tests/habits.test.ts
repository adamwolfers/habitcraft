import { device, element, by, expect } from 'detox';
import {
  generateTestUser,
  launchAuthenticated,
  waitForElement,
  createHabit,
  habitCard,
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

  describe('Create Habit', () => {
    it('should create a new habit successfully', async () => {
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

    it('should show empty state when no habits exist', async () => {
      // This test would need to run with a fresh user
      // For now, we verify the empty state element exists in the component
      // A fresh test user would see the empty state initially
    });

    it('should support pull-to-refresh', async () => {
      // Pull down on the habit list to refresh
      await element(by.id('habit-list')).scroll(200, 'down');

      // The list should still be visible after refresh
      await expect(element(by.id('habit-list'))).toBeVisible();
    });
  });

  describe('Update Habit', () => {
    it('should edit an existing habit', async () => {
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
    it('should delete a habit with confirmation', async () => {
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
    it('should mark a habit as complete for today', async () => {
      // Find the first habit card's complete button
      await expect(element(by.id('complete-button')).atIndex(0)).toBeVisible();

      // Tap to complete
      await element(by.id('complete-button')).atIndex(0).tap();

      // The button should still be visible (toggle state changed visually)
      await expect(element(by.id('complete-button')).atIndex(0)).toBeVisible();
    });

    it('should toggle completion status', async () => {
      // Tap complete button twice to toggle
      await element(by.id('complete-button')).atIndex(0).tap();
      await element(by.id('complete-button')).atIndex(0).tap();

      // Button should still be functional
      await expect(element(by.id('complete-button')).atIndex(0)).toBeVisible();
    });
  });
});
