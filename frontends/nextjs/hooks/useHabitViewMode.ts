'use client';

import { useLocalStorage } from './useLocalStorage';

export type ViewMode = 'weekly' | 'monthly';

export function useHabitViewMode(habitId: string): [ViewMode, (value: ViewMode) => void] {
  const storageKey = `habitcraft-view-${habitId}`;
  return useLocalStorage<ViewMode>(storageKey, 'weekly');
}
