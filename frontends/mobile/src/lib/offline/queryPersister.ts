import { Persister, PersistedClient } from '@tanstack/react-query-persist-client';
import { offlineStorage } from './offlineStorage';

export function createFilePersister(key: string): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await offlineStorage.write(key, client);
    },
    restoreClient: async () => {
      const client = await offlineStorage.read<PersistedClient>(key);
      return client ?? undefined;
    },
    removeClient: async () => {
      await offlineStorage.remove(key);
    },
  };
}
