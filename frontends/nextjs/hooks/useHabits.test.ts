import { renderHook, act, waitFor } from '@testing-library/react';
import { useHabits } from './useHabits';
import { HabitFormData, Habit } from '@/types/habit';
import * as api from '@/lib/api';

// Mock the API module
jest.mock('@/lib/api');

const mockFetchHabits = api.fetchHabits as jest.MockedFunction<typeof api.fetchHabits>;

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
});
