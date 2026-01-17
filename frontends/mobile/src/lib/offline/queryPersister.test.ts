import { createFilePersister } from './queryPersister';
import { offlineStorage } from './offlineStorage';
import { PersistedClient } from '@tanstack/react-query-persist-client';

jest.mock('./offlineStorage');

const mockOfflineStorage = offlineStorage as jest.Mocked<typeof offlineStorage>;

describe('queryPersister', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFilePersister', () => {
    it('creates persister with correct key', () => {
      const persister = createFilePersister('test-key');

      expect(persister).toHaveProperty('persistClient');
      expect(persister).toHaveProperty('restoreClient');
      expect(persister).toHaveProperty('removeClient');
    });
  });

  describe('persistClient', () => {
    it('saves client state to storage', async () => {
      mockOfflineStorage.write.mockResolvedValue(undefined);
      const persister = createFilePersister('query-cache');

      const mockClient: PersistedClient = {
        timestamp: Date.now(),
        buster: '',
        clientState: {
          queries: [],
          mutations: [],
        },
      };

      await persister.persistClient(mockClient);

      expect(mockOfflineStorage.write).toHaveBeenCalledWith('query-cache', mockClient);
    });
  });

  describe('restoreClient', () => {
    it('returns stored client state', async () => {
      const mockClient: PersistedClient = {
        timestamp: Date.now(),
        buster: '',
        clientState: {
          queries: [
            {
              queryKey: ['habits'],
              queryHash: '["habits"]',
              state: {
                data: [{ id: '1', name: 'Test Habit' }],
                dataUpdateCount: 1,
                dataUpdatedAt: Date.now(),
                error: null,
                errorUpdateCount: 0,
                errorUpdatedAt: 0,
                fetchFailureCount: 0,
                fetchFailureReason: null,
                fetchMeta: null,
                isInvalidated: false,
                status: 'success',
                fetchStatus: 'idle',
              },
            },
          ],
          mutations: [],
        },
      };
      mockOfflineStorage.read.mockResolvedValue(mockClient);
      const persister = createFilePersister('query-cache');

      const result = await persister.restoreClient();

      expect(result).toEqual(mockClient);
      expect(mockOfflineStorage.read).toHaveBeenCalledWith('query-cache');
    });

    it('returns undefined when no stored state', async () => {
      mockOfflineStorage.read.mockResolvedValue(null);
      const persister = createFilePersister('query-cache');

      const result = await persister.restoreClient();

      expect(result).toBeUndefined();
    });
  });

  describe('removeClient', () => {
    it('removes stored client state', async () => {
      mockOfflineStorage.remove.mockResolvedValue(undefined);
      const persister = createFilePersister('query-cache');

      await persister.removeClient();

      expect(mockOfflineStorage.remove).toHaveBeenCalledWith('query-cache');
    });
  });
});
