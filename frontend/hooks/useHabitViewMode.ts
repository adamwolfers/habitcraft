'use client';

import { useLocalStorage } from './useLocalStorage';
import { habitViewModeKey } from '@/utils/storageUtils';

export type ViewMode = 'weekly' | 'monthly';

export function useHabitViewMode(habitId: string): [ViewMode, (value: ViewMode) => void] {
  return useLocalStorage<ViewMode>(habitViewModeKey(habitId), 'weekly');
}
