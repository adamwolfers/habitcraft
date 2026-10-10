const HABIT_VIEW_MODE_PREFIX = 'habitcraft-view-';

/** localStorage key holding the weekly/monthly view choice for one habit. */
export function habitViewModeKey(habitId: string): string {
  return `${HABIT_VIEW_MODE_PREFIX}${habitId}`;
}

/**
 * Remove every stored habit view mode. Called when the account is deleted, so
 * the next person on this browser does not inherit preferences keyed by habit
 * ids that no longer exist.
 */
export function clearHabitViewModes(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(HABIT_VIEW_MODE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.error('Error clearing habit view modes from localStorage:', error);
  }
}
