import * as FileSystem from 'expo-file-system';
import { QueuedMutation } from './types';

const STORAGE_PREFIX = 'offline_';
const MUTATION_QUEUE_KEY = 'mutation-queue';

function getFilePath(key: string): string {
  return `${FileSystem.documentDirectory}${STORAGE_PREFIX}${key}.json`;
}

async function read<T>(key: string): Promise<T | null> {
  try {
    const filePath = getFilePath(key);
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      return null;
    }

    const content = await FileSystem.readAsStringAsync(filePath);
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('offlineStorage.read error:', error);
    return null;
  }
}

async function write<T>(key: string, data: T): Promise<void> {
  try {
    const filePath = getFilePath(key);
    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data));
  } catch (error) {
    console.error('offlineStorage.write error:', error);
  }
}

async function remove(key: string): Promise<void> {
  try {
    const filePath = getFilePath(key);
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
    }
  } catch (error) {
    console.error('offlineStorage.remove error:', error);
  }
}

async function getMutationQueue(): Promise<QueuedMutation[]> {
  const queue = await read<QueuedMutation[]>(MUTATION_QUEUE_KEY);
  return queue ?? [];
}

async function saveMutationQueue(queue: QueuedMutation[]): Promise<void> {
  await write(MUTATION_QUEUE_KEY, queue);
}

async function clearMutationQueue(): Promise<void> {
  await remove(MUTATION_QUEUE_KEY);
}

export const offlineStorage = {
  read,
  write,
  remove,
  getMutationQueue,
  saveMutationQueue,
  clearMutationQueue,
};
