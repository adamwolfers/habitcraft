import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import {
  useHabits,
  useHabit,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useCompleteHabit,
  useUncompleteHabit,
} from './useHabits';
import { habitsApi } from '@/lib/habits';
import { mutationQueue, networkStatus } from '@/lib/offline';
import { Habit, HabitWithStats } from '@/types';
import { QueuedMutation } from '@/lib/offline/types';

jest.mock('@/lib/habits');
jest.mock('@/lib/offline/mutationQueue');
jest.mock('@/lib/offline/networkStatus');
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

const mockHabitsApi = habitsApi as jest.Mocked<typeof habitsApi>;
const mockMutationQueue = mutationQueue as jest.Mocked<typeof mutationQueue>;
const mockNetworkStatus = networkStatus as jest.Mocked<typeof networkStatus>;
const mockToast = Toast as jest.Mocked<typeof Toast>;

const mockQueuedMutation: QueuedMutation = {
  id: 'mutation-1',
  type: 'createHabit',
  payload: {},
  timestamp: Date.now(),
  retryCount: 0,
};

const mockHabit: HabitWithStats = {
  id: 'habit-1',
  userId: 'user-1',
  name: 'Exercise',
  description: 'Daily workout',
  icon: '💪',
  color: '#10b981',
  frequency: 'daily',
  target_days: undefined,
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  completions: [],
};

const mockHabit2: HabitWithStats = {
  id: 'habit-2',
  userId: 'user-1',
  name: 'Read',
  description: 'Read a book',
  icon: '📚',
  color: '#6366f1',
  frequency: 'daily',
  target_days: undefined,
  status: 'active',
  createdAt: '2024-01-02T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  completions: [],
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createWrapperWithClient() {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
}

describe('useHabits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetworkStatus.isOnline.mockResolvedValue(true);
  });

  describe('useHabits query', () => {
    it('fetches habits successfully', async () => {
      mockHabitsApi.getHabits.mockResolvedValue([mockHabit, mockHabit2]);

      const { result } = renderHook(() => useHabits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([mockHabit, mockHabit2]);
      expect(mockHabitsApi.getHabits).toHaveBeenCalledTimes(1);
    });

    it('handles fetch error', async () => {
      mockHabitsApi.getHabits.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useHabits(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('useHabit query', () => {
    it('fetches single habit successfully', async () => {
      mockHabitsApi.getHabit.mockResolvedValue(mockHabit);

      const { result } = renderHook(() => useHabit('habit-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockHabit);
      expect(mockHabitsApi.getHabit).toHaveBeenCalledWith('habit-1');
    });

    it('does not fetch when id is empty', () => {
      const { result } = renderHook(() => useHabit(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockHabitsApi.getHabit).not.toHaveBeenCalled();
    });
  });

  describe('useCreateHabit mutation', () => {
    const createData = {
      name: 'New Habit',
      description: 'A new habit',
      icon: '🎯',
      color: '#ef4444',
      frequency: 'daily' as const,
    };

    it('creates habit when online', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const createdHabit = { ...mockHabit, ...createData, id: 'new-habit-id' };
      mockHabitsApi.createHabit.mockResolvedValue(createdHabit);

      const { result } = renderHook(() => useCreateHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(createData);
      });

      expect(mockHabitsApi.createHabit).toHaveBeenCalledWith(createData);
      expect(mockToast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          text1: 'Habit created',
        })
      );
    });

    it('queues mutation when offline', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(false);
      mockMutationQueue.add.mockResolvedValue(mockQueuedMutation);

      const { result } = renderHook(() => useCreateHabit(), {
        wrapper: createWrapper(),
      });

      let createdHabit;
      await act(async () => {
        createdHabit = await result.current.mutateAsync(createData);
      });

      expect(mockMutationQueue.add).toHaveBeenCalledWith(
        'createHabit',
        createData,
        'temp-mock-uuid'
      );
      expect(mockHabitsApi.createHabit).not.toHaveBeenCalled();
      expect(createdHabit).toMatchObject({
        id: 'temp-mock-uuid',
        name: createData.name,
        icon: createData.icon,
        color: createData.color,
      });
    });

    it('adds completions: [] to the cache when the server response omits it', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      // Real POST /habits response is a plain Habit — no completions field.
      const serverHabit: Habit = {
        id: 'new-habit-id',
        userId: 'user-1',
        name: createData.name,
        description: createData.description,
        icon: createData.icon,
        color: createData.color,
        frequency: createData.frequency,
        target_days: undefined,
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      mockHabitsApi.createHabit.mockResolvedValue(serverHabit);

      const { Wrapper, queryClient } = createWrapperWithClient();
      const { result } = renderHook(() => useCreateHabit(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync(createData);
      });

      const cached = queryClient.getQueryData<HabitWithStats[]>(['habits']);
      expect(cached).toHaveLength(1);
      expect(cached?.[0].completions).toEqual([]);
    });

    it('adds completions: [] to the cache for the offline optimistic habit', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(false);
      mockMutationQueue.add.mockResolvedValue(mockQueuedMutation);

      const { Wrapper, queryClient } = createWrapperWithClient();
      const { result } = renderHook(() => useCreateHabit(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync(createData);
      });

      const cached = queryClient.getQueryData<HabitWithStats[]>(['habits']);
      expect(cached).toHaveLength(1);
      expect(cached?.[0].completions).toEqual([]);
    });

    it('shows error toast on failure', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      mockHabitsApi.createHabit.mockRejectedValue(new Error('Create failed'));

      const { result } = renderHook(() => useCreateHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync(createData);
        } catch {
          // Expected to throw
        }
      });

      expect(mockToast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Failed to create habit',
        })
      );
    });
  });

  describe('useUpdateHabit mutation', () => {
    const updateData = {
      id: 'habit-1',
      data: { name: 'Updated Habit' },
    };

    it('updates habit when online', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const updatedHabit = { ...mockHabit, name: 'Updated Habit' };
      mockHabitsApi.updateHabit.mockResolvedValue(updatedHabit);

      const { result } = renderHook(() => useUpdateHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(updateData);
      });

      expect(mockHabitsApi.updateHabit).toHaveBeenCalledWith('habit-1', {
        name: 'Updated Habit',
      });
      expect(mockToast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          text1: 'Habit updated',
        })
      );
    });

    it('queues mutation when offline with cached habit', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(false);
      mockMutationQueue.add.mockResolvedValue(mockQueuedMutation);

      // First, populate the cache
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(['habits'], [mockHabit]);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useUpdateHabit(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync(updateData);
      });

      expect(mockMutationQueue.add).toHaveBeenCalledWith('updateHabit', updateData);
      expect(mockHabitsApi.updateHabit).not.toHaveBeenCalled();
    });

    it('throws error when offline and habit not in cache', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(false);

      const { result } = renderHook(() => useUpdateHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync(updateData);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Habit not found in cache');
        }
      });
    });

    it('shows error toast on failure', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      mockHabitsApi.updateHabit.mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useUpdateHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync(updateData);
        } catch {
          // Expected to throw
        }
      });

      expect(mockToast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Failed to update habit',
        })
      );
    });
  });

  describe('useDeleteHabit mutation', () => {
    it('deletes habit when online', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      mockHabitsApi.deleteHabit.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('habit-1');
      });

      expect(mockHabitsApi.deleteHabit).toHaveBeenCalledWith('habit-1');
      expect(mockToast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          text1: 'Habit deleted',
        })
      );
    });

    it('queues mutation when offline', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(false);
      mockMutationQueue.add.mockResolvedValue(mockQueuedMutation);

      const { result } = renderHook(() => useDeleteHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('habit-1');
      });

      expect(mockMutationQueue.add).toHaveBeenCalledWith('deleteHabit', {
        id: 'habit-1',
      });
      expect(mockHabitsApi.deleteHabit).not.toHaveBeenCalled();
    });

    it('shows error toast on failure', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      mockHabitsApi.deleteHabit.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useDeleteHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync('habit-1');
        } catch {
          // Expected to throw
        }
      });

      expect(mockToast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Failed to delete habit',
        })
      );
    });
  });

  describe('useCompleteHabit mutation', () => {
    const completeData = {
      id: 'habit-1',
      data: {
        date: '2024-01-15',
        notes: 'Great workout!',
      },
    };

    it('completes habit when online', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const completion = {
        id: 'completion-1',
        habit_id: 'habit-1',
        completed_date: '2024-01-15',
        note: 'Great workout!',
        created_at: '2024-01-15T10:00:00Z',
      };
      mockHabitsApi.completeHabit.mockResolvedValue(completion);

      const { result } = renderHook(() => useCompleteHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(completeData);
      });

      expect(mockHabitsApi.completeHabit).toHaveBeenCalledWith('habit-1', completeData.data);
    });

    it('queues mutation when offline', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(false);
      mockMutationQueue.add.mockResolvedValue(mockQueuedMutation);

      const { result } = renderHook(() => useCompleteHabit(), {
        wrapper: createWrapper(),
      });

      let completion;
      await act(async () => {
        completion = await result.current.mutateAsync(completeData);
      });

      expect(mockMutationQueue.add).toHaveBeenCalledWith('completeHabit', completeData);
      expect(mockHabitsApi.completeHabit).not.toHaveBeenCalled();
      expect(completion).toMatchObject({
        id: 'temp-completion-mock-uuid',
        habit_id: 'habit-1',
        completed_date: '2024-01-15',
      });
    });
  });

  describe('useUncompleteHabit mutation', () => {
    const uncompleteData = {
      id: 'habit-1',
      completedDate: '2024-01-15',
    };

    it('uncompletes habit when online', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      mockHabitsApi.uncompleteHabit.mockResolvedValue(undefined);

      const { result } = renderHook(() => useUncompleteHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(uncompleteData);
      });

      expect(mockHabitsApi.uncompleteHabit).toHaveBeenCalledWith('habit-1', '2024-01-15');
    });

    it('queues mutation when offline', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(false);
      mockMutationQueue.add.mockResolvedValue(mockQueuedMutation);

      const { result } = renderHook(() => useUncompleteHabit(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(uncompleteData);
      });

      expect(mockMutationQueue.add).toHaveBeenCalledWith('uncompleteHabit', uncompleteData);
      expect(mockHabitsApi.uncompleteHabit).not.toHaveBeenCalled();
    });
  });
});
