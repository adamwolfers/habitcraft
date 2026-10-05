import { renderHook, act, waitFor } from '@testing-library/react';
import { useHabits } from './useHabits';
import { HabitFormData, Habit, HabitWithCompletions, Completion } from '@/types/habit';
import * as api from '@/lib/api';
import * as authContextModule from '@/context/AuthContext';
import * as confettiUtils from '@/utils/confettiUtils';
import { createMockAuth } from '@/test-utils/mockAuthContext';

// Mock the API module
jest.mock('@/lib/api');

// Mock the confetti utils
jest.mock('@/utils/confettiUtils', () => ({
  triggerConfetti: jest.fn(),
}));

const mockTriggerConfetti = confettiUtils.triggerConfetti as jest.MockedFunction<
  typeof confettiUtils.triggerConfetti
>;

// Mock the useAuth hook
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = authContextModule.useAuth as jest.MockedFunction<
  typeof authContextModule.useAuth
>;

const mockFetchHabits = api.fetchHabits as jest.MockedFunction<typeof api.fetchHabits>;
const mockCreateHabit = api.createHabit as jest.MockedFunction<typeof api.createHabit>;
const mockFetchCompletions = api.fetchCompletions as jest.MockedFunction<
  typeof api.fetchCompletions
>;
const mockCreateCompletion = api.createCompletion as jest.MockedFunction<
  typeof api.createCompletion
>;
const mockDeleteCompletion = api.deleteCompletion as jest.MockedFunction<
  typeof api.deleteCompletion
>;
const mockDeleteHabit = api.deleteHabit as jest.MockedFunction<typeof api.deleteHabit>;
const mockUpdateHabit = api.updateHabit as jest.MockedFunction<typeof api.updateHabit>;
const mockUpdateCompletionNote = api.updateCompletionNote as jest.MockedFunction<
  typeof api.updateCompletionNote
>;

describe('useHabits', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockHabits: Habit[] = [
    {
      id: 'habit-1',
      userId: mockUserId,
      name: 'Morning Exercise',
      description: null,
      color: '#3B82F6',
      icon: '⭐',
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'habit-2',
      userId: mockUserId,
      name: 'Read Books',
      description: 'Read for 30 minutes',
      color: '#FF5733',
      icon: '📚',
      status: 'active',
      createdAt: '2025-01-02T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    },
  ];

  // GET /habits embeds each habit's completions, and the dashboard reads them
  // from there rather than fetching per habit (habitcraft-1bw). Builds that
  // response from bare habits plus the completions to embed under each.
  const habitsResponse = (
    habits: Habit[],
    completions: Completion[] = []
  ): HabitWithCompletions[] =>
    habits.map((habit) => ({
      ...habit,
      completions: completions.filter((completion) => completion.habitId === habit.id),
    }));

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock returns empty array
    mockFetchHabits.mockResolvedValue([]);
    // Default: user is authenticated
    mockUseAuth.mockReturnValue(
      createMockAuth({
        user: {
          id: mockUserId,
          email: 'test@example.com',
          name: 'Test User',
          createdAt: '2025-01-01',
        },
      })
    );
  });

  it('should initialize with empty habits array', async () => {
    const { result } = renderHook(() => useHabits(mockUserId));
    expect(result.current.habits).toEqual([]);

    // Wait for async state updates to complete
    await waitFor(() => {
      expect(result.current.habits).toEqual([]);
    });
  });

  it('should fetch habits from API on mount', async () => {
    mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));

    const { result } = renderHook(() => useHabits(mockUserId));

    await waitFor(() => {
      expect(result.current.habits).toEqual(mockHabits);
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
    mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));

    const { result } = renderHook(() => useHabits(mockUserId));

    await waitFor(() => {
      expect(result.current.habits).toHaveLength(2);
    });

    // All returned habits should be active (we'd filter on backend)
    expect(result.current.habits.every((h) => h.status === 'active')).toBe(true);
  });

  it('should not fetch habits if userId is not provided', async () => {
    const { result } = renderHook(() => useHabits(''));

    expect(result.current.habits).toEqual([]);
    expect(mockFetchHabits).not.toHaveBeenCalled();

    // Wait a bit to ensure no async operations are triggered
    await waitFor(() => {
      expect(mockFetchHabits).not.toHaveBeenCalled();
    });
  });

  describe('authentication awareness', () => {
    it('should not fetch habits when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue(createMockAuth());

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait to ensure no async operations are triggered
      await waitFor(() => {
        expect(result.current.habits).toEqual([]);
      });

      expect(mockFetchHabits).not.toHaveBeenCalled();
    });

    it('should not fetch habits while authentication is loading', async () => {
      mockUseAuth.mockReturnValue(createMockAuth({ isLoading: true }));

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait to ensure no async operations are triggered
      await waitFor(() => {
        expect(result.current.habits).toEqual([]);
      });

      expect(mockFetchHabits).not.toHaveBeenCalled();
    });

    it('should fetch habits when user becomes authenticated', async () => {
      // Start with loading state
      mockUseAuth.mockReturnValue(createMockAuth({ isLoading: true }));

      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));

      const { result, rerender } = renderHook(() => useHabits(mockUserId));

      // Should not fetch while loading
      expect(mockFetchHabits).not.toHaveBeenCalled();

      // Simulate auth completing
      mockUseAuth.mockReturnValue(
        createMockAuth({
          user: {
            id: mockUserId,
            email: 'test@example.com',
            name: 'Test User',
            createdAt: '2025-01-01',
          },
        })
      );

      rerender();

      // Now it should fetch
      await waitFor(() => {
        expect(mockFetchHabits).toHaveBeenCalledWith(mockUserId);
      });

      await waitFor(() => {
        expect(result.current.habits).toEqual(mockHabits);
      });
    });

    it('should return isLoading state from hook', async () => {
      mockUseAuth.mockReturnValue(createMockAuth({ isLoading: true }));

      const { result } = renderHook(() => useHabits(mockUserId));

      expect(result.current.isAuthLoading).toBe(true);
    });
  });

  describe('createHabit', () => {
    it('should create a habit via API and update local state', async () => {
      const newHabitFormData: HabitFormData = {
        name: 'Meditation',
        description: 'Meditate for 10 minutes',
        color: '#10B981',
        icon: '🧘',
      };

      const createdHabit: Habit = {
        id: 'habit-3',
        userId: mockUserId,
        name: 'Meditation',
        description: 'Meditate for 10 minutes',
        color: '#10B981',
        icon: '🧘',
        status: 'active',
        createdAt: '2025-01-03T00:00:00.000Z',
        updatedAt: '2025-01-03T00:00:00.000Z',
      };

      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));
      mockCreateHabit.mockResolvedValue(createdHabit);

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.habits).toEqual(mockHabits);
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
      };

      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));
      mockCreateHabit.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.habits).toEqual(mockHabits);
      });

      // Try to create a habit (should throw)
      await act(async () => {
        try {
          await result.current.createHabit(newHabitFormData);
        } catch {
          // Expected to throw
        }
      });

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating habit:', expect.any(Error));

      // Verify habits array wasn't modified
      expect(result.current.habits).toEqual(mockHabits);

      consoleErrorSpy.mockRestore();
    });

    it('should return the created habit from createHabit', async () => {
      const newHabitFormData: HabitFormData = {
        name: 'Running',
      };

      const createdHabit: Habit = {
        id: 'habit-4',
        userId: mockUserId,
        name: 'Running',
        description: null,
        color: '#3B82F6',
        icon: '🏃',
        status: 'active',
        createdAt: '2025-01-04T00:00:00.000Z',
        updatedAt: '2025-01-04T00:00:00.000Z',
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

  describe('completion tracking', () => {
    const mockCompletions: Completion[] = [
      {
        id: 'completion-1',
        habitId: 'habit-1',
        date: '2025-01-15',
        notes: null,
        createdAt: '2025-01-15T10:00:00.000Z',
      },
      {
        id: 'completion-2',
        habitId: 'habit-1',
        date: '2025-01-14',
        notes: 'Great session',
        createdAt: '2025-01-14T10:00:00.000Z',
      },
    ];

    it('should load completions from the GET /habits response in a single request', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits, mockCompletions));

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.getCompletionsForHabit('habit-1')).toEqual(mockCompletions);
      });

      expect(mockFetchHabits).toHaveBeenCalledTimes(1);
      expect(mockFetchCompletions).not.toHaveBeenCalled();
      expect(result.current.getCompletionsForHabit('habit-2')).toEqual([]);
    });

    it('should not keep the embedded completions on the habits it exposes', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits, mockCompletions));

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(mockHabits.length);
      });

      // The completions map is the one copy the hook keeps in step with
      // toggles and note edits; a second copy on each habit would go stale.
      result.current.habits.forEach((habit) => {
        expect(habit).not.toHaveProperty('completions');
      });
    });

    it('should check if habit is completed on a specific date', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], mockCompletions));

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      // Check completed date
      const isCompleted = result.current.isHabitCompletedOnDate('habit-1', new Date('2025-01-15'));
      expect(isCompleted).toBe(true);

      // Check non-completed date
      const isNotCompleted = result.current.isHabitCompletedOnDate(
        'habit-1',
        new Date('2025-01-16')
      );
      expect(isNotCompleted).toBe(false);
    });

    it('should toggle completion - create when not completed', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], []));

      const newCompletion: Completion = {
        id: 'completion-new',
        habitId: 'habit-1',
        date: '2025-01-16',
        notes: null,
        createdAt: '2025-01-16T10:00:00.000Z',
      };

      mockCreateCompletion.mockResolvedValue(newCompletion);

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      // Toggle completion (should create)
      await act(async () => {
        await result.current.toggleCompletion('habit-1', new Date('2025-01-16'));
      });

      expect(mockCreateCompletion).toHaveBeenCalledWith(mockUserId, 'habit-1', '2025-01-16');

      // Verify completion is now marked as completed
      const isCompleted = result.current.isHabitCompletedOnDate('habit-1', new Date('2025-01-16'));
      expect(isCompleted).toBe(true);
    });

    it('should toggle completion - delete when already completed', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], mockCompletions));
      mockDeleteCompletion.mockResolvedValue();

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      // Verify initially completed
      let isCompleted = result.current.isHabitCompletedOnDate('habit-1', new Date('2025-01-15'));
      expect(isCompleted).toBe(true);

      // Toggle completion (should delete)
      await act(async () => {
        await result.current.toggleCompletion('habit-1', new Date('2025-01-15'));
      });

      expect(mockDeleteCompletion).toHaveBeenCalledWith(mockUserId, 'habit-1', '2025-01-15');

      // Verify completion is now removed
      isCompleted = result.current.isHabitCompletedOnDate('habit-1', new Date('2025-01-15'));
      expect(isCompleted).toBe(false);
    });

    it('should handle toggle completion errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], []));
      mockCreateCompletion.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      // Try to toggle completion
      await act(async () => {
        await result.current.toggleCompletion('habit-1', new Date('2025-01-16'));
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error toggling completion:', expect.any(Error));

      // Verify state wasn't updated
      const isCompleted = result.current.isHabitCompletedOnDate('habit-1', new Date('2025-01-16'));
      expect(isCompleted).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should return false for non-existent habit', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits, []));

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(2);
      });

      const isCompleted = result.current.isHabitCompletedOnDate(
        'non-existent',
        new Date('2025-01-15')
      );
      expect(isCompleted).toBe(false);
    });

    it('should trigger confetti when creating a completion', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], []));

      const newCompletion: Completion = {
        id: 'completion-new',
        habitId: 'habit-1',
        date: '2025-01-16',
        notes: null,
        createdAt: '2025-01-16T10:00:00.000Z',
      };

      mockCreateCompletion.mockResolvedValue(newCompletion);

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      // Clear any previous calls
      mockTriggerConfetti.mockClear();

      // Toggle completion (should create and trigger confetti)
      await act(async () => {
        await result.current.toggleCompletion('habit-1', new Date('2025-01-16'));
      });

      expect(mockTriggerConfetti).toHaveBeenCalledTimes(1);
    });

    it('should NOT trigger confetti when deleting a completion', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], mockCompletions));
      mockDeleteCompletion.mockResolvedValue();

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      // Clear any previous calls
      mockTriggerConfetti.mockClear();

      // Toggle completion (should delete, not create)
      await act(async () => {
        await result.current.toggleCompletion('habit-1', new Date('2025-01-15'));
      });

      expect(mockDeleteCompletion).toHaveBeenCalled();
      expect(mockTriggerConfetti).not.toHaveBeenCalled();
    });

    it('should NOT trigger confetti when completion creation fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], []));
      mockCreateCompletion.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      // Clear any previous calls
      mockTriggerConfetti.mockClear();

      // Toggle completion (should fail)
      await act(async () => {
        await result.current.toggleCompletion('habit-1', new Date('2025-01-16'));
      });

      expect(mockTriggerConfetti).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('updateHabit', () => {
    it('should update a habit via API and update local state', async () => {
      const updatedHabit: Habit = {
        ...mockHabits[0],
        name: 'Updated Exercise',
        description: 'New description',
      };

      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));
      mockUpdateHabit.mockResolvedValue(updatedHabit);

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.habits).toEqual(mockHabits);
      });

      // Update the habit
      let returnedHabit: Habit | undefined;
      await act(async () => {
        returnedHabit = await result.current.updateHabit('habit-1', {
          name: 'Updated Exercise',
          description: 'New description',
        });
      });

      // Verify API was called with correct data
      expect(mockUpdateHabit).toHaveBeenCalledWith(mockUserId, 'habit-1', {
        name: 'Updated Exercise',
        description: 'New description',
      });

      // Verify returned habit matches updated data
      expect(returnedHabit).toEqual(updatedHabit);

      // Verify local state was updated
      expect(result.current.habits[0].name).toBe('Updated Exercise');
      expect(result.current.habits[0].description).toBe('New description');
      // Other habit should be unchanged
      expect(result.current.habits[1]).toEqual(mockHabits[1]);
    });

    it('should handle update errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));
      mockUpdateHabit.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.habits).toEqual(mockHabits);
      });

      // Try to update a habit (should throw)
      await act(async () => {
        try {
          await result.current.updateHabit('habit-1', { name: 'New Name' });
        } catch {
          // Expected to throw
        }
      });

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating habit:', expect.any(Error));

      // Verify habits array wasn't modified
      expect(result.current.habits).toEqual(mockHabits);

      consoleErrorSpy.mockRestore();
    });

    it('should return the updated habit from updateHabit', async () => {
      const updatedHabit: Habit = {
        ...mockHabits[0],
        color: '#FF0000',
      };

      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));
      mockUpdateHabit.mockResolvedValue(updatedHabit);

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(2);
      });

      let returnedHabit: Habit | undefined;
      await act(async () => {
        returnedHabit = await result.current.updateHabit('habit-1', { color: '#FF0000' });
      });

      expect(returnedHabit).toEqual(updatedHabit);
      expect(returnedHabit?.color).toBe('#FF0000');
    });
  });

  describe('deleteHabit', () => {
    it('should delete a habit via API and update local state', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));
      mockDeleteHabit.mockResolvedValue();

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.habits).toEqual(mockHabits);
      });

      // Verify we have 2 habits initially
      expect(result.current.habits).toHaveLength(2);

      // Delete the first habit
      await act(async () => {
        await result.current.deleteHabit('habit-1');
      });

      // Verify API was called with correct data
      expect(mockDeleteHabit).toHaveBeenCalledWith(mockUserId, 'habit-1');

      // Verify habit was removed from local state
      expect(result.current.habits).toHaveLength(1);
      expect(result.current.habits[0].id).toBe('habit-2');
      expect(result.current.habits.find((h) => h.id === 'habit-1')).toBeUndefined();
    });

    it('should handle deletion errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));
      mockDeleteHabit.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.habits).toEqual(mockHabits);
      });

      // Try to delete a habit (should throw)
      await act(async () => {
        try {
          await result.current.deleteHabit('habit-1');
        } catch {
          // Expected to throw
        }
      });

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting habit:', expect.any(Error));

      // Verify habits array wasn't modified
      expect(result.current.habits).toEqual(mockHabits);
      expect(result.current.habits).toHaveLength(2);

      consoleErrorSpy.mockRestore();
    });

    it('should remove habit completions when habit is deleted', async () => {
      const mockCompletions: Completion[] = [
        {
          id: 'completion-1',
          habitId: 'habit-1',
          date: '2025-01-15',
          notes: null,
          createdAt: '2025-01-15T10:00:00.000Z',
        },
      ];

      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits, mockCompletions));
      mockDeleteHabit.mockResolvedValue();

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.habits).toHaveLength(2);
      });

      // Verify completion exists for habit-1
      expect(result.current.isHabitCompletedOnDate('habit-1', new Date('2025-01-15'))).toBe(true);

      // Delete the habit
      await act(async () => {
        await result.current.deleteHabit('habit-1');
      });

      // Verify habit and its completions are removed
      expect(result.current.habits).toHaveLength(1);
      expect(result.current.isHabitCompletedOnDate('habit-1', new Date('2025-01-15'))).toBe(false);
    });

    it('should handle deletion of non-existent habit ID', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse(mockHabits));
      mockDeleteHabit.mockResolvedValue();

      const { result } = renderHook(() => useHabits(mockUserId));

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.habits).toHaveLength(2);
      });

      // Delete a non-existent habit (API returns 204 even if not found in some cases)
      await act(async () => {
        await result.current.deleteHabit('non-existent-id');
      });

      // Verify API was called
      expect(mockDeleteHabit).toHaveBeenCalledWith(mockUserId, 'non-existent-id');

      // Verify habits array is unchanged (habit wasn't in local state)
      expect(result.current.habits).toEqual(mockHabits);
    });
  });

  describe('updateNote', () => {
    const mockCompletions: Completion[] = [
      {
        id: 'completion-1',
        habitId: 'habit-1',
        date: '2025-01-15',
        notes: null,
        createdAt: '2025-01-15T10:00:00.000Z',
      },
    ];

    it('should update note via API and update local state', async () => {
      const updatedCompletion: Completion = {
        ...mockCompletions[0],
        notes: 'Ran 5 miles',
      };

      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], mockCompletions));
      mockUpdateCompletionNote.mockResolvedValue(updatedCompletion);

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      // Update the note
      await act(async () => {
        await result.current.updateNote('habit-1', '2025-01-15', 'Ran 5 miles');
      });

      // Verify API was called with correct data
      expect(mockUpdateCompletionNote).toHaveBeenCalledWith(
        mockUserId,
        'habit-1',
        '2025-01-15',
        'Ran 5 miles'
      );

      // Verify local state was updated
      const completions = result.current.getCompletionsForHabit('habit-1');
      const updatedEntry = completions.find((c) => c.date === '2025-01-15');
      expect(updatedEntry?.notes).toBe('Ran 5 miles');
    });

    it('should clear note when null is passed', async () => {
      const completionWithNote: Completion = {
        ...mockCompletions[0],
        notes: 'Existing note',
      };

      const updatedCompletion: Completion = {
        ...mockCompletions[0],
        notes: null,
      };

      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], [completionWithNote]));
      mockUpdateCompletionNote.mockResolvedValue(updatedCompletion);

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      // Clear the note
      await act(async () => {
        await result.current.updateNote('habit-1', '2025-01-15', null);
      });

      // Verify API was called with null
      expect(mockUpdateCompletionNote).toHaveBeenCalledWith(
        mockUserId,
        'habit-1',
        '2025-01-15',
        null
      );

      // Verify local state was updated
      const completions = result.current.getCompletionsForHabit('habit-1');
      const updatedEntry = completions.find((c) => c.date === '2025-01-15');
      expect(updatedEntry?.notes).toBeNull();
    });

    it('should handle update errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], mockCompletions));
      mockUpdateCompletionNote.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      // Try to update note (should throw)
      await act(async () => {
        try {
          await result.current.updateNote('habit-1', '2025-01-15', 'New note');
        } catch {
          // Expected to throw
        }
      });

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating note:', expect.any(Error));

      // Verify local state wasn't modified
      const completions = result.current.getCompletionsForHabit('habit-1');
      const entry = completions.find((c) => c.date === '2025-01-15');
      expect(entry?.notes).toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getCompletionsForHabit', () => {
    const mockCompletions: Completion[] = [
      {
        id: 'completion-1',
        habitId: 'habit-1',
        date: '2025-01-15',
        notes: 'Great workout',
        createdAt: '2025-01-15T10:00:00.000Z',
      },
      {
        id: 'completion-2',
        habitId: 'habit-1',
        date: '2025-01-14',
        notes: null,
        createdAt: '2025-01-14T10:00:00.000Z',
      },
    ];

    it('should return completions array for a habit', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], mockCompletions));

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      const completions = result.current.getCompletionsForHabit('habit-1');
      expect(completions).toEqual(mockCompletions);
    });

    it('should return empty array for habit with no completions', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], []));

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      const completions = result.current.getCompletionsForHabit('habit-1');
      expect(completions).toEqual([]);
    });

    it('should return empty array for non-existent habit', async () => {
      mockFetchHabits.mockResolvedValue(habitsResponse([mockHabits[0]], mockCompletions));

      const { result } = renderHook(() => useHabits(mockUserId));

      await waitFor(() => {
        expect(result.current.habits).toHaveLength(1);
      });

      const completions = result.current.getCompletionsForHabit('non-existent');
      expect(completions).toEqual([]);
    });
  });
});
