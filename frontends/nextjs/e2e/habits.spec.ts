import { test, expect, Page } from '@playwright/test';

/**
 * Habit Management E2E Tests
 *
 * Test credentials (from test-fixtures.sql):
 * - User 1: test@example.com / Test1234!
 * - User 2: test2@example.com / Test1234!
 *
 * Test habits (from test-fixtures.sql):
 * - Morning Exercise (active)
 * - Read Books (active)
 * - Archived Habit (archived)
 *
 * Test isolation strategy:
 * - Fixture habits are READ ONLY - never modified
 * - Create/Update/Delete tests create unique habits with Date.now() timestamps
 * - Each test is independent and can run in any order
 */

/**
 * Helper to find a habit card by its name.
 * Uses the h3 heading containing the habit name to find its parent card.
 */
function getHabitCard(page: Page, habitName: string) {
  // Find the card container that has the h3 with the exact habit name
  return page.locator('div.bg-gray-800').filter({
    has: page.locator('h3', { hasText: habitName })
  });
}

test.describe('Habit Management', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('Test1234!');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL('/dashboard');
    // Wait for habits to load
    await expect(page.getByText('Morning Exercise')).toBeVisible();
  });

  test.describe('Create Habit', () => {
    test('should create a new habit and see it in the list', async ({ page }) => {
      // Generate unique habit name to avoid conflicts
      const habitName = `E2E Test Habit ${Date.now()}`;

      // Click the "Add New Habit" button
      await page.getByRole('button', { name: /add new habit/i }).click();

      // Fill in the habit form
      await page.getByLabel(/habit name/i).fill(habitName);
      await page.getByLabel(/description/i).fill('This is a test habit created by E2E tests');

      // Select a color (click the green one)
      const colorButtons = page.locator('button[style*="background-color"]');
      await colorButtons.nth(1).click(); // Green color

      // Submit the form
      await page.getByRole('button', { name: /^add habit$/i }).click();

      // Verify the new habit appears in the list
      await expect(page.getByText(habitName)).toBeVisible();
      await expect(page.getByText('This is a test habit created by E2E tests')).toBeVisible();
    });

    test('should create a habit with selected icon', async ({ page }) => {
      // Generate unique habit name to avoid conflicts
      const habitName = `Icon Test Habit ${Date.now()}`;

      // Click the "Add New Habit" button
      await page.getByRole('button', { name: /add new habit/i }).click();

      // Fill in the habit form
      await page.getByLabel(/habit name/i).fill(habitName);

      // Select the book icon (📚)
      await page.getByTestId('icon-option-📚').click();

      // Submit the form
      await page.getByRole('button', { name: /^add habit$/i }).click();

      // Verify the new habit appears with the selected icon
      await expect(page.getByText(habitName)).toBeVisible();
      const habitCard = getHabitCard(page, habitName);
      await expect(habitCard.locator('text=📚')).toBeVisible();
    });

    test('should require habit name', async ({ page }) => {
      // Click the "Add New Habit" button
      await page.getByRole('button', { name: /add new habit/i }).click();

      // Try to submit without filling the name
      const submitButton = page.getByRole('button', { name: /^add habit$/i });
      await submitButton.click();

      // Form should still be visible (not submitted)
      await expect(page.getByLabel(/habit name/i)).toBeVisible();
    });

    test('should cancel habit creation', async ({ page }) => {
      // Click the "Add New Habit" button
      await page.getByRole('button', { name: /add new habit/i }).click();

      // Fill in some data
      await page.getByLabel(/habit name/i).fill('Should be cancelled');

      // Click cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Form should be closed
      await expect(page.getByLabel(/habit name/i)).not.toBeVisible();

      // The habit should not exist
      await expect(page.getByText('Should be cancelled')).not.toBeVisible();
    });
  });

  test.describe('Update Habit', () => {
    /**
     * Helper to create a unique habit for testing updates.
     * This ensures test isolation - we don't modify fixture data.
     */
    async function createTestHabit(page: Page, prefix: string) {
      const habitName = `${prefix} ${Date.now()}`;
      await page.getByRole('button', { name: /add new habit/i }).click();
      await page.getByLabel(/habit name/i).fill(habitName);
      await page.getByLabel(/description/i).fill('Original description');
      await page.getByRole('button', { name: /^add habit$/i }).click();
      await expect(page.getByText(habitName)).toBeVisible();
      return habitName;
    }

    test('should update habit name and description', async ({ page }) => {
      // Create a unique habit for this test (ensures isolation)
      const originalName = await createTestHabit(page, 'Update Test');

      // Find and click the edit button on our test habit
      const habitCard = getHabitCard(page, originalName);
      await habitCard.getByRole('button', { name: /edit habit/i }).click();

      // Verify modal opened
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Edit Habit')).toBeVisible();

      // Update the name
      const nameInput = page.getByLabel(/habit name/i);
      await nameInput.clear();
      await nameInput.fill(`${originalName} Updated`);

      // Update the description
      const descriptionInput = page.getByLabel(/description/i);
      await descriptionInput.clear();
      await descriptionInput.fill('Updated description for E2E test');

      // Save changes
      await page.getByRole('button', { name: /save/i }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Verify changes persisted
      await expect(page.getByText(`${originalName} Updated`)).toBeVisible();
      await expect(page.getByText('Updated description for E2E test')).toBeVisible();
    });

    test('should update habit color', async ({ page }) => {
      // Create a unique habit for this test (ensures isolation)
      const habitName = await createTestHabit(page, 'Color Test');

      // Find and click the edit button on our test habit
      const habitCard = getHabitCard(page, habitName);
      await habitCard.getByRole('button', { name: /edit habit/i }).click();

      // Verify modal opened
      await expect(page.getByRole('dialog')).toBeVisible();

      // Select a different color (red)
      await page.getByTestId('color-option-#ef4444').click();

      // Save changes
      await page.getByRole('button', { name: /save/i }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Reload to verify persistence
      await page.reload();
      await expect(page.getByText(habitName)).toBeVisible();
    });

    test('should update habit icon', async ({ page }) => {
      // Create a unique habit for this test (ensures isolation)
      const habitName = await createTestHabit(page, 'Icon Test');

      // Find and click the edit button on our test habit
      const habitCard = getHabitCard(page, habitName);
      await habitCard.getByRole('button', { name: /edit habit/i }).click();

      // Verify modal opened
      await expect(page.getByRole('dialog')).toBeVisible();

      // Select a different icon (meditation)
      await page.getByTestId('icon-option-🧘').click();

      // Save changes
      await page.getByRole('button', { name: /save/i }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Verify the new icon is displayed on our habit card
      const updatedCard = getHabitCard(page, habitName);
      await expect(updatedCard.locator('text=🧘')).toBeVisible();
    });

    test('should cancel habit update', async ({ page }) => {
      // Create a unique habit for this test (ensures isolation)
      const habitName = await createTestHabit(page, 'Cancel Test');

      // Find and click the edit button on our test habit
      const habitCard = getHabitCard(page, habitName);
      await habitCard.getByRole('button', { name: /edit habit/i }).click();

      // Verify modal opened
      await expect(page.getByRole('dialog')).toBeVisible();

      // Modify the name
      const nameInput = page.getByLabel(/habit name/i);
      await nameInput.clear();
      await nameInput.fill('This should not be saved');

      // Click cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Original name should still be there
      await expect(page.getByText(habitName)).toBeVisible();
      await expect(page.getByText('This should not be saved')).not.toBeVisible();
    });

    test('should close modal by clicking outside', async ({ page }) => {
      // Create a unique habit for this test (ensures isolation)
      const habitName = await createTestHabit(page, 'Modal Test');

      // Find and click the edit button
      const habitCard = getHabitCard(page, habitName);
      await habitCard.getByRole('button', { name: /edit habit/i }).click();

      // Verify modal opened
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click the backdrop
      await page.getByTestId('modal-backdrop').click({ position: { x: 10, y: 10 } });

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Delete Habit', () => {
    test('should delete a habit and remove it from the list', async ({ page }) => {
      // First create a habit to delete (so we don't mess up fixture data)
      const habitName = `Habit to delete ${Date.now()}`;
      await page.getByRole('button', { name: /add new habit/i }).click();
      await page.getByLabel(/habit name/i).fill(habitName);
      await page.getByRole('button', { name: /^add habit$/i }).click();

      // Verify it was created
      await expect(page.getByText(habitName)).toBeVisible();

      // Find and click the delete button
      const habitCard = getHabitCard(page, habitName);
      await habitCard.getByRole('button', { name: /delete habit/i }).click();

      // Verify habit is removed from list
      await expect(page.getByText(habitName)).not.toBeVisible();
    });

    test('should persist deletion after page reload', async ({ page }) => {
      // Create a habit to delete
      const habitName = `Persistence test ${Date.now()}`;
      await page.getByRole('button', { name: /add new habit/i }).click();
      await page.getByLabel(/habit name/i).fill(habitName);
      await page.getByRole('button', { name: /^add habit$/i }).click();
      await expect(page.getByText(habitName)).toBeVisible();

      // Delete the habit
      const habitCard = getHabitCard(page, habitName);
      await habitCard.getByRole('button', { name: /delete habit/i }).click();
      await expect(page.getByText(habitName)).not.toBeVisible();

      // Reload the page
      await page.reload();

      // Habit should still be gone
      await expect(page.getByText(habitName)).not.toBeVisible();
    });
  });

});
