import * as FileSystem from 'expo-file-system/legacy';
import { offlineStorage } from './offlineStorage';
import { QueuedMutation } from './types';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/documents/',
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('offlineStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('read', () => {
    it('returns null when file does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
        isDirectory: false,
      } as FileSystem.FileInfo);

      const result = await offlineStorage.read('test-key');

      expect(result).toBeNull();
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(
        '/mock/documents/offline_test-key.json'
      );
    });

    it('reads and parses JSON from file', async () => {
      const testData = { foo: 'bar', count: 42 };
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      } as FileSystem.FileInfo);
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(testData));

      const result = await offlineStorage.read('test-key');

      expect(result).toEqual(testData);
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalledWith(
        '/mock/documents/offline_test-key.json'
      );
    });

    it('returns null and logs error on read failure', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      } as FileSystem.FileInfo);
      mockFileSystem.readAsStringAsync.mockRejectedValue(new Error('Read failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await offlineStorage.read('test-key');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('offlineStorage.read error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('returns null on invalid JSON', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      } as FileSystem.FileInfo);
      mockFileSystem.readAsStringAsync.mockResolvedValue('not valid json');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await offlineStorage.read('test-key');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('write', () => {
    it('writes JSON to file', async () => {
      mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
      const testData = { foo: 'bar', count: 42 };

      await offlineStorage.write('test-key', testData);

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        '/mock/documents/offline_test-key.json',
        JSON.stringify(testData)
      );
    });

    it('logs error on write failure', async () => {
      mockFileSystem.writeAsStringAsync.mockRejectedValue(new Error('Write failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await offlineStorage.write('test-key', { data: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith('offlineStorage.write error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('remove', () => {
    it('deletes file when it exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      } as FileSystem.FileInfo);
      mockFileSystem.deleteAsync.mockResolvedValue(undefined);

      await offlineStorage.remove('test-key');

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        '/mock/documents/offline_test-key.json'
      );
    });

    it('does nothing when file does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
        isDirectory: false,
      } as FileSystem.FileInfo);

      await offlineStorage.remove('test-key');

      expect(mockFileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('logs error on delete failure', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      } as FileSystem.FileInfo);
      mockFileSystem.deleteAsync.mockRejectedValue(new Error('Delete failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await offlineStorage.remove('test-key');

      expect(consoleSpy).toHaveBeenCalledWith('offlineStorage.remove error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getMutationQueue', () => {
    it('returns empty array when no queue exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
        isDirectory: false,
      } as FileSystem.FileInfo);

      const result = await offlineStorage.getMutationQueue();

      expect(result).toEqual([]);
    });

    it('returns stored mutation queue', async () => {
      const mockQueue: QueuedMutation[] = [
        {
          id: 'mut-1',
          type: 'createHabit',
          payload: { name: 'Test Habit' },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      } as FileSystem.FileInfo);
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockQueue));

      const result = await offlineStorage.getMutationQueue();

      expect(result).toEqual(mockQueue);
    });
  });

  describe('saveMutationQueue', () => {
    it('saves mutation queue to storage', async () => {
      mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
      const mockQueue: QueuedMutation[] = [
        {
          id: 'mut-1',
          type: 'createHabit',
          payload: { name: 'Test Habit' },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      await offlineStorage.saveMutationQueue(mockQueue);

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        '/mock/documents/offline_mutation-queue.json',
        JSON.stringify(mockQueue)
      );
    });
  });

  describe('clearMutationQueue', () => {
    it('removes mutation queue file', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        uri: '',
        size: 0,
        modificationTime: 0,
      } as FileSystem.FileInfo);
      mockFileSystem.deleteAsync.mockResolvedValue(undefined);

      await offlineStorage.clearMutationQueue();

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        '/mock/documents/offline_mutation-queue.json'
      );
    });
  });
});
