import { mutationQueue } from './mutationQueue';
import { offlineStorage } from './offlineStorage';
import { QueuedMutation } from './types';

jest.mock('./offlineStorage');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

const mockOfflineStorage = offlineStorage as jest.Mocked<typeof offlineStorage>;

describe('mutationQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mutationQueue.clearMemoryCache();
  });

  describe('add', () => {
    it('adds mutation to empty queue', async () => {
      mockOfflineStorage.getMutationQueue.mockResolvedValue([]);
      mockOfflineStorage.saveMutationQueue.mockResolvedValue(undefined);

      const mutation = await mutationQueue.add('createHabit', { name: 'Test' });

      expect(mutation).toEqual({
        id: 'mock-uuid',
        type: 'createHabit',
        payload: { name: 'Test' },
        timestamp: expect.any(Number),
        retryCount: 0,
        tempId: undefined,
      });
      expect(mockOfflineStorage.saveMutationQueue).toHaveBeenCalledWith([mutation]);
    });

    it('adds mutation with tempId for creates', async () => {
      mockOfflineStorage.getMutationQueue.mockResolvedValue([]);
      mockOfflineStorage.saveMutationQueue.mockResolvedValue(undefined);

      const mutation = await mutationQueue.add('createHabit', { name: 'Test' }, 'temp-123');

      expect(mutation.tempId).toBe('temp-123');
    });

    it('appends to existing queue', async () => {
      const existingMutation: QueuedMutation = {
        id: 'existing-1',
        type: 'updateHabit',
        payload: { id: '1', data: { name: 'Updated' } },
        timestamp: Date.now() - 1000,
        retryCount: 0,
      };
      mockOfflineStorage.getMutationQueue.mockResolvedValue([existingMutation]);
      mockOfflineStorage.saveMutationQueue.mockResolvedValue(undefined);

      await mutationQueue.add('deleteHabit', { id: '2' });

      expect(mockOfflineStorage.saveMutationQueue).toHaveBeenCalledWith([
        existingMutation,
        expect.objectContaining({ type: 'deleteHabit' }),
      ]);
    });
  });

  describe('remove', () => {
    it('removes mutation by id', async () => {
      const mutations: QueuedMutation[] = [
        {
          id: 'mut-1',
          type: 'createHabit',
          payload: {},
          timestamp: Date.now(),
          retryCount: 0,
        },
        {
          id: 'mut-2',
          type: 'updateHabit',
          payload: {},
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];
      mockOfflineStorage.getMutationQueue.mockResolvedValue(mutations);
      mockOfflineStorage.saveMutationQueue.mockResolvedValue(undefined);

      await mutationQueue.remove('mut-1');

      expect(mockOfflineStorage.saveMutationQueue).toHaveBeenCalledWith([mutations[1]]);
    });

    it('handles removing non-existent mutation', async () => {
      const mutations: QueuedMutation[] = [
        {
          id: 'mut-1',
          type: 'createHabit',
          payload: {},
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];
      mockOfflineStorage.getMutationQueue.mockResolvedValue(mutations);
      mockOfflineStorage.saveMutationQueue.mockResolvedValue(undefined);

      await mutationQueue.remove('non-existent');

      expect(mockOfflineStorage.saveMutationQueue).toHaveBeenCalledWith(mutations);
    });
  });

  describe('getAll', () => {
    it('returns all queued mutations', async () => {
      const mutations: QueuedMutation[] = [
        {
          id: 'mut-1',
          type: 'createHabit',
          payload: {},
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];
      mockOfflineStorage.getMutationQueue.mockResolvedValue(mutations);

      const result = await mutationQueue.getAll();

      expect(result).toEqual(mutations);
    });

    it('returns empty array when queue is empty', async () => {
      mockOfflineStorage.getMutationQueue.mockResolvedValue([]);

      const result = await mutationQueue.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getCount', () => {
    it('returns count of queued mutations', async () => {
      const mutations: QueuedMutation[] = [
        { id: 'mut-1', type: 'createHabit', payload: {}, timestamp: Date.now(), retryCount: 0 },
        { id: 'mut-2', type: 'updateHabit', payload: {}, timestamp: Date.now(), retryCount: 0 },
        { id: 'mut-3', type: 'deleteHabit', payload: {}, timestamp: Date.now(), retryCount: 0 },
      ];
      mockOfflineStorage.getMutationQueue.mockResolvedValue(mutations);

      const count = await mutationQueue.getCount();

      expect(count).toBe(3);
    });
  });

  describe('incrementRetry', () => {
    it('increments retry count for mutation', async () => {
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'createHabit',
        payload: {},
        timestamp: Date.now(),
        retryCount: 0,
      };
      mockOfflineStorage.getMutationQueue.mockResolvedValue([mutation]);
      mockOfflineStorage.saveMutationQueue.mockResolvedValue(undefined);

      await mutationQueue.incrementRetry('mut-1');

      expect(mockOfflineStorage.saveMutationQueue).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'mut-1', retryCount: 1 }),
      ]);
    });
  });

  describe('clear', () => {
    it('clears entire queue', async () => {
      mockOfflineStorage.clearMutationQueue.mockResolvedValue(undefined);

      await mutationQueue.clear();

      expect(mockOfflineStorage.clearMutationQueue).toHaveBeenCalled();
    });
  });

  describe('updateTempId', () => {
    it('replaces tempId with real id in payload', async () => {
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'completeHabit',
        payload: { id: 'temp-123', data: { completed_date: '2024-01-01' } },
        timestamp: Date.now(),
        retryCount: 0,
      };
      mockOfflineStorage.getMutationQueue.mockResolvedValue([mutation]);
      mockOfflineStorage.saveMutationQueue.mockResolvedValue(undefined);

      await mutationQueue.updateTempId('temp-123', 'real-456');

      expect(mockOfflineStorage.saveMutationQueue).toHaveBeenCalledWith([
        expect.objectContaining({
          payload: { id: 'real-456', data: { completed_date: '2024-01-01' } },
        }),
      ]);
    });

    it('handles nested id in payload', async () => {
      const mutation: QueuedMutation = {
        id: 'mut-1',
        type: 'updateHabit',
        payload: { id: 'temp-123', data: { name: 'Updated' } },
        timestamp: Date.now(),
        retryCount: 0,
      };
      mockOfflineStorage.getMutationQueue.mockResolvedValue([mutation]);
      mockOfflineStorage.saveMutationQueue.mockResolvedValue(undefined);

      await mutationQueue.updateTempId('temp-123', 'real-456');

      expect(mockOfflineStorage.saveMutationQueue).toHaveBeenCalledWith([
        expect.objectContaining({
          payload: { id: 'real-456', data: { name: 'Updated' } },
        }),
      ]);
    });
  });
});
