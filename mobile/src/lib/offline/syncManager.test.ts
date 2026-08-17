import { syncManager } from './syncManager';
import { mutationQueue } from './mutationQueue';
import { networkStatus } from './networkStatus';
import { habitsApi } from '@/lib/habits';
import { QueuedMutation } from './types';

jest.mock('./mutationQueue');
jest.mock('./networkStatus');
jest.mock('@/lib/habits');

const mockMutationQueue = mutationQueue as jest.Mocked<typeof mutationQueue>;
const mockNetworkStatus = networkStatus as jest.Mocked<typeof networkStatus>;
const mockHabitsApi = habitsApi as jest.Mocked<typeof habitsApi>;

describe('syncManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sync', () => {
    it('skips sync when offline', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(false);

      const result = await syncManager.sync();

      expect(result).toEqual({
        success: false,
        processedCount: 0,
        failedCount: 0,
        errors: [],
      });
      expect(mockMutationQueue.getAll).not.toHaveBeenCalled();
    });

    it('returns success when queue is empty', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      mockMutationQueue.getAll.mockResolvedValue([]);

      const result = await syncManager.sync();

      expect(result).toEqual({
        success: true,
        processedCount: 0,
        failedCount: 0,
        errors: [],
      });
    });

    it('processes createHabit mutation', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'createHabit',
        payload: { name: 'Test Habit', icon: '🏃', color: '#FF0000' },
        timestamp: Date.now(),
        retryCount: 0,
        tempId: 'temp-123',
      };
      mockMutationQueue.getAll.mockResolvedValue([mutation]);
      mockHabitsApi.createHabit.mockResolvedValue({
        id: 'real-456',
        userId: 'user-1',
        name: 'Test Habit',
        icon: '🏃',
        color: '#FF0000',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      mockMutationQueue.remove.mockResolvedValue(undefined);
      mockMutationQueue.updateTempId.mockResolvedValue(undefined);

      const result = await syncManager.sync();

      expect(mockHabitsApi.createHabit).toHaveBeenCalledWith(mutation.payload);
      expect(mockMutationQueue.updateTempId).toHaveBeenCalledWith('temp-123', 'real-456');
      expect(mockMutationQueue.remove).toHaveBeenCalledWith('mut-1');
      expect(result.processedCount).toBe(1);
      expect(result.success).toBe(true);
    });

    it('processes updateHabit mutation', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'updateHabit',
        payload: { id: 'habit-1', data: { name: 'Updated Habit' } },
        timestamp: Date.now(),
        retryCount: 0,
      };
      mockMutationQueue.getAll.mockResolvedValue([mutation]);
      mockHabitsApi.updateHabit.mockResolvedValue({
        id: 'habit-1',
        userId: 'user-1',
        name: 'Updated Habit',
        icon: '🏃',
        color: '#FF0000',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      mockMutationQueue.remove.mockResolvedValue(undefined);

      const result = await syncManager.sync();

      expect(mockHabitsApi.updateHabit).toHaveBeenCalledWith('habit-1', { name: 'Updated Habit' });
      expect(mockMutationQueue.remove).toHaveBeenCalledWith('mut-1');
      expect(result.processedCount).toBe(1);
    });

    it('processes deleteHabit mutation', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'deleteHabit',
        payload: { id: 'habit-1' },
        timestamp: Date.now(),
        retryCount: 0,
      };
      mockMutationQueue.getAll.mockResolvedValue([mutation]);
      mockHabitsApi.deleteHabit.mockResolvedValue(undefined);
      mockMutationQueue.remove.mockResolvedValue(undefined);

      const result = await syncManager.sync();

      expect(mockHabitsApi.deleteHabit).toHaveBeenCalledWith('habit-1');
      expect(mockMutationQueue.remove).toHaveBeenCalledWith('mut-1');
      expect(result.processedCount).toBe(1);
    });

    it('processes completeHabit mutation', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'completeHabit',
        payload: { id: 'habit-1', data: { completed_date: '2024-01-15' } },
        timestamp: Date.now(),
        retryCount: 0,
      };
      mockMutationQueue.getAll.mockResolvedValue([mutation]);
      mockHabitsApi.completeHabit.mockResolvedValue({
        id: 'completion-1',
        habit_id: 'habit-1',
        completed_date: '2024-01-15',
        created_at: new Date().toISOString(),
      });
      mockMutationQueue.remove.mockResolvedValue(undefined);

      const result = await syncManager.sync();

      expect(mockHabitsApi.completeHabit).toHaveBeenCalledWith('habit-1', {
        completed_date: '2024-01-15',
      });
      expect(mockMutationQueue.remove).toHaveBeenCalledWith('mut-1');
      expect(result.processedCount).toBe(1);
    });

    it('processes uncompleteHabit mutation', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'uncompleteHabit',
        payload: { id: 'habit-1', completedDate: '2024-01-15' },
        timestamp: Date.now(),
        retryCount: 0,
      };
      mockMutationQueue.getAll.mockResolvedValue([mutation]);
      mockHabitsApi.uncompleteHabit.mockResolvedValue(undefined);
      mockMutationQueue.remove.mockResolvedValue(undefined);

      const result = await syncManager.sync();

      expect(mockHabitsApi.uncompleteHabit).toHaveBeenCalledWith('habit-1', '2024-01-15');
      expect(mockMutationQueue.remove).toHaveBeenCalledWith('mut-1');
      expect(result.processedCount).toBe(1);
    });

    it('handles retryable errors', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'createHabit',
        payload: { name: 'Test' },
        timestamp: Date.now(),
        retryCount: 0,
      };
      mockMutationQueue.getAll.mockResolvedValue([mutation]);
      const networkError = new Error('Network error');
      (networkError as Error & { response?: { status: number } }).response = undefined;
      mockHabitsApi.createHabit.mockRejectedValue(networkError);
      mockMutationQueue.incrementRetry.mockResolvedValue(undefined);

      const result = await syncManager.sync();

      expect(mockMutationQueue.incrementRetry).toHaveBeenCalledWith('mut-1');
      expect(mockMutationQueue.remove).not.toHaveBeenCalled();
      expect(result.failedCount).toBe(1);
      expect(result.errors[0].isRetryable).toBe(true);
    });

    it('removes non-retryable mutations (404)', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'updateHabit',
        payload: { id: 'deleted-habit', data: { name: 'Test' } },
        timestamp: Date.now(),
        retryCount: 0,
      };
      mockMutationQueue.getAll.mockResolvedValue([mutation]);
      const notFoundError = new Error('Not found');
      (notFoundError as Error & { response?: { status: number } }).response = { status: 404 };
      mockHabitsApi.updateHabit.mockRejectedValue(notFoundError);
      mockMutationQueue.remove.mockResolvedValue(undefined);

      const result = await syncManager.sync();

      expect(mockMutationQueue.remove).toHaveBeenCalledWith('mut-1');
      expect(result.failedCount).toBe(1);
      expect(result.errors[0].isRetryable).toBe(false);
    });

    it('removes mutations after max retries', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'createHabit',
        payload: { name: 'Test' },
        timestamp: Date.now(),
        retryCount: 3, // Max retries reached
      };
      mockMutationQueue.getAll.mockResolvedValue([mutation]);
      mockHabitsApi.createHabit.mockRejectedValue(new Error('Server error'));
      mockMutationQueue.remove.mockResolvedValue(undefined);

      const result = await syncManager.sync();

      expect(mockMutationQueue.remove).toHaveBeenCalledWith('mut-1');
      expect(result.failedCount).toBe(1);
      expect(result.errors[0].isRetryable).toBe(false);
    });

    it('processes mutations in order', async () => {
      mockNetworkStatus.isOnline.mockResolvedValue(true);
      const mutations: QueuedMutation[] = [
        {
          id: 'mut-1',
          type: 'createHabit',
          payload: { name: 'First' },
          timestamp: 1000,
          retryCount: 0,
        },
        {
          id: 'mut-2',
          type: 'createHabit',
          payload: { name: 'Second' },
          timestamp: 2000,
          retryCount: 0,
        },
      ];
      mockMutationQueue.getAll.mockResolvedValue(mutations);
      mockHabitsApi.createHabit.mockResolvedValue({
        id: 'new-id',
        userId: 'user-1',
        name: 'Test',
        icon: '🏃',
        color: '#FF0000',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      mockMutationQueue.remove.mockResolvedValue(undefined);

      await syncManager.sync();

      const calls = mockHabitsApi.createHabit.mock.calls;
      expect(calls[0][0]).toEqual({ name: 'First' });
      expect(calls[1][0]).toEqual({ name: 'Second' });
    });
  });

  describe('isSyncing', () => {
    it('returns false initially', () => {
      expect(syncManager.isSyncing()).toBe(false);
    });
  });
});
