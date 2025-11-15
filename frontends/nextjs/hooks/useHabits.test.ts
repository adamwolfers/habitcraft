import { renderHook, act, waitFor } from '@testing-library/react';
import { useHabits } from './useHabits';
import { HabitFormData } from '@/types/habit';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useHabits', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should initialize with empty habits array', () => {
    const { result } = renderHook(() => useHabits());
    expect(result.current.habits).toEqual([]);
  });

  it('should load habits from localStorage on mount', async () => {
    const storedHabits = [
      {
        id: '1',
        name: 'Exercise',
        description: 'Daily workout',
        color: '#3b82f6',
        createdAt: '2025-10-30T12:00:00.000Z',
        completedDates: [],
      },
    ];

    localStorageMock.setItem('habits', JSON.stringify(storedHabits));

    const { result } = renderHook(() => useHabits());

    await waitFor(() => {
      expect(result.current.habits).toEqual(storedHabits);
    });
  });

  it('should add a new habit', async () => {
    const { result } = renderHook(() => useHabits());

    const newHabit: HabitFormData = {
      name: 'Read',
      description: '30 minutes of reading',
      color: '#10b981',
    };

    await act(async () => {
      result.current.addHabit(newHabit);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.habits).toHaveLength(1);
    expect(result.current.habits[0]).toMatchObject({
      name: 'Read',
      description: '30 minutes of reading',
      color: '#10b981',
      completedDates: [],
    });
    expect(result.current.habits[0].id).toBeDefined();
    expect(result.current.habits[0].createdAt).toBeDefined();
  });

  it('should delete a habit', async () => {
    const { result } = renderHook(() => useHabits());

    const habitData: HabitFormData = {
      name: 'Meditate',
      color: '#8b5cf6',
    };

    await act(async () => {
      result.current.addHabit(habitData);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const habitId = result.current.habits[0].id;

    await act(async () => {
      result.current.deleteHabit(habitId);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.habits).toHaveLength(0);
  });

  it('should toggle habit completion', async () => {
    const { result } = renderHook(() => useHabits());

    const habitData: HabitFormData = {
      name: 'Exercise',
      color: '#3b82f6',
    };

    await act(async () => {
      result.current.addHabit(habitData);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const habitId = result.current.habits[0].id;
    const testDate = new Date('2025-10-30');

    // Complete the habit
    await act(async () => {
      result.current.toggleHabitCompletion(habitId, testDate);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.habits[0].completedDates).toContain('2025-10-30');
    expect(result.current.isHabitCompletedOnDate(habitId, testDate)).toBe(true);

    // Uncomplete the habit
    await act(async () => {
      result.current.toggleHabitCompletion(habitId, testDate);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.habits[0].completedDates).not.toContain('2025-10-30');
    expect(result.current.isHabitCompletedOnDate(habitId, testDate)).toBe(false);
  });

  it('should check if habit is completed on a specific date', async () => {
    const { result } = renderHook(() => useHabits());

    const habitData: HabitFormData = {
      name: 'Yoga',
      color: '#ec4899',
    };

    await act(async () => {
      result.current.addHabit(habitData);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const habitId = result.current.habits[0].id;
    const date1 = new Date('2025-10-30');
    const date2 = new Date('2025-10-31');

    await act(async () => {
      result.current.toggleHabitCompletion(habitId, date1);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isHabitCompletedOnDate(habitId, date1)).toBe(true);
    expect(result.current.isHabitCompletedOnDate(habitId, date2)).toBe(false);
  });

  it('should persist habits to localStorage', async () => {
    const { result } = renderHook(() => useHabits());

    const habitData: HabitFormData = {
      name: 'Write',
      description: 'Journal entry',
      color: '#f59e0b',
    };

    await act(async () => {
      result.current.addHabit(habitData);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    const stored = localStorageMock.getItem('habits');
    expect(stored).toBeDefined();

    const parsedHabits = JSON.parse(stored!);
    expect(parsedHabits).toHaveLength(1);
    expect(parsedHabits[0].name).toBe('Write');
  });

  it('should return false for non-existent habit in isHabitCompletedOnDate', () => {
    const { result } = renderHook(() => useHabits());
    const date = new Date('2025-10-30');

    expect(result.current.isHabitCompletedOnDate('non-existent-id', date)).toBe(false);
  });
});
