import { renderHook, act, waitFor } from '@testing-library/react';
import { useHabits } from './useHabits';
import { HabitFormData, Habit } from '@/types/habit';
import * as api from '@/lib/api';

// Mock the API module
jest.mock('@/lib/api');

const mockFetchHabits = api.fetchHabits as jest.MockedFunction<typeof api.fetchHabits>;
const mockCreateHabit = api.createHabit as jest.MockedFunction<typeof api.createHabit>;

describe('useHabits', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockHabitsFromApi: Habit[] = [
    {
      id: 'habit-1',
      userId: mockUserId,
      name: 'Morning Exercise',
      description: null,
      frequency: 'daily',
      targetDays: [],
      color: '#3B82F6',
      icon: '⭐',
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'habit-2',
      userId: mockUserId,
      name: 'Read Books',
      description: 'Read for 30 minutes',
      frequency: 'weekly',
      targetDays: [1, 3, 5],
      color: '#FF5733',
      icon: '📚',
      status: 'active',
      createdAt: '2025-01-02T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock returns empty array
    mockFetchHabits.mockResolvedValue([]);
  });

  it('should initialize with empty habits array', () => {
    const { result } = renderHook(() => useHabits(mockUserId));
    expect(result.current.habits).toEqual([]);
  });

  it('should fetch habits from API on mount', async () => {
    mockFetchHabits.mockResolvedValue(mockHabitsFromApi);

    const { result } = renderHook(() => useHabits(mockUserId));

    await waitFor(() => {
      expect(result.current.habits).toEqual(mockHabitsFromApi);
    });

    expect(mockFetchHabits).toHaveBeenCalledTimes(1);
    expect(mockFetchHabits).toHaveBeenCalledWith(mockUserId);
  });

  it('should handle API errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockFetchHabits.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useHabits(mockUserId));

    await waitFor(() => {
      expect(result.current.habits).toEqual([]);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching habits:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should handle empty habits response', async () => {
    mockFetchHabits.mockResolvedValue([]);

    const { result } = renderHook(() => useHabits(mockUserId));

    await waitFor(() => {
      expect(result.current.habits).toEqual([]);
    });

    expect(mockFetchHabits).toHaveBeenCalledTimes(1);
  });

  it('should filter active habits', async () => {
    mockFetchHabits.mockResolvedValue(mockHabitsFromApi);

    const { result } = renderHook(() => useHabits(mockUserId));

    await waitFor(() => {
      expect(result.current.habits).toHaveLength(2);
    });

    // All returned habits should be active (we'd filter on backend)
    expect(result.current.habits.every(h => h.status === 'active')).toBe(true);
  });

  it('should not fetch habits if userId is not provided', () => {
    const { result } = renderHook(() => useHabits(''));

    expect(result.current.habits).toEqual([]);
    expect(mockFetchHabits).not.toHaveBeenCalled();
  });

  describe('createHabit', () => {
    it('should create a habit via API and update local state', async () => {
      const newHabitFormData: HabitFormData = {
        name: 'Meditation',
        description: 'Meditate for 10 minutes',
        frequency: 'daily',
        color: '#10B981',
        icon: '🧘'
      };

      const createdHabit: Habit = {
        id: 'habit-3',
        userId: mockUserId,
        name: 'Meditation',
        description: 'Meditate for 10 minutes',
        frequency: 'daily',
        targetDays: [],
        color: '#10B981',
        icon: '🧘',
        status: 'active',
        createdAt: '2025-01-03T00:00:00.000Z',
        updatedAt: '2025-01-03T00:00:00.000Z'
      };

      mockFetchHabits.mockResolvedValue(mockHabitsFromApi);
      mockCreateHabit.mockResolvedValue(createdHabit);

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.habits).toEqual(mockHabitsFromApi);
      });

      // Create a new habit
      await act(async () => {
        await result.current.createHabit(newHabitFormData);
      });

      // Verify API was called with correct data
      expect(mockCreateHabit).toHaveBeenCalledWith(mockUserId, newHabitFormData);

      // Verify habit was added to local state
      expect(result.current.habits).toHaveLength(3);
      expect(result.current.habits[2]).toEqual(createdHabit);
    });

    it('should handle creation errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const newHabitFormData: HabitFormData = {
        name: 'Failed Habit',
        frequency: 'daily'
      };

      mockFetchHabits.mockResolvedValue(mockHabitsFromApi);
      mockCreateHabit.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.habits).toEqual(mockHabitsFromApi);
      });

      // Try to create a habit (should throw)
      await act(async () => {
        try {
          await result.current.createHabit(newHabitFormData);
        } catch (error) {
          // Expected to throw
        }
      });

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating habit:', expect.any(Error));

      // Verify habits array wasn't modified
      expect(result.current.habits).toEqual(mockHabitsFromApi);

      consoleErrorSpy.mockRestore();
    });

    it('should return the created habit from createHabit', async () => {
      const newHabitFormData: HabitFormData = {
        name: 'Running',
        frequency: 'weekly',
        targetDays: [1, 3, 5]
      };

      const createdHabit: Habit = {
        id: 'habit-4',
        userId: mockUserId,
        name: 'Running',
        description: null,
        frequency: 'weekly',
        targetDays: [1, 3, 5],
        color: '#3B82F6',
        icon: '🏃',
        status: 'active',
        createdAt: '2025-01-04T00:00:00.000Z',
        updatedAt: '2025-01-04T00:00:00.000Z'
      };

      mockFetchHabits.mockResolvedValue([]);
      mockCreateHabit.mockResolvedValue(createdHabit);

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.habits).toEqual([]);
      });

      let returnedHabit: Habit | undefined;

      // Create habit and capture return value
      await act(async () => {
        returnedHabit = await result.current.createHabit(newHabitFormData);
      });

      // Verify the returned habit matches what was created
      expect(returnedHabit).toEqual(createdHabit);
    });
  });
});
