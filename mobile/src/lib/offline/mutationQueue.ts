import { randomUUID } from 'expo-crypto';
import { offlineStorage } from './offlineStorage';
import { QueuedMutation, MutationType } from './types';

// In-memory cache for faster access
let memoryCache: QueuedMutation[] | null = null;

// Told the queue's length after every write. The dashboard's pending count
// stays mounted while changes are queued and synced, so reading the count once
// left it permanently stale (habitcraft-bqhe.24).
type CountListener = (count: number) => void;
const listeners = new Set<CountListener>();

function notify(count: number): void {
  listeners.forEach((listener) => listener(count));
}

function subscribe(listener: CountListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function loadQueue(): Promise<QueuedMutation[]> {
  if (memoryCache === null) {
    memoryCache = await offlineStorage.getMutationQueue();
  }
  return memoryCache;
}

async function saveQueue(queue: QueuedMutation[]): Promise<void> {
  memoryCache = queue;
  await offlineStorage.saveMutationQueue(queue);
  notify(queue.length);
}

async function add(type: MutationType, payload: unknown, tempId?: string): Promise<QueuedMutation> {
  const queue = await loadQueue();

  const mutation: QueuedMutation = {
    id: randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    tempId,
  };

  const newQueue = [...queue, mutation];
  await saveQueue(newQueue);

  return mutation;
}

async function remove(mutationId: string): Promise<void> {
  const queue = await loadQueue();
  const newQueue = queue.filter((m) => m.id !== mutationId);
  await saveQueue(newQueue);
}

async function getAll(): Promise<QueuedMutation[]> {
  return loadQueue();
}

async function getCount(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}

async function incrementRetry(mutationId: string): Promise<void> {
  const queue = await loadQueue();
  const newQueue = queue.map((m) =>
    m.id === mutationId ? { ...m, retryCount: m.retryCount + 1 } : m
  );
  await saveQueue(newQueue);
}

async function clear(): Promise<void> {
  memoryCache = [];
  await offlineStorage.clearMutationQueue();
  notify(0);
}

async function updateTempId(tempId: string, realId: string): Promise<void> {
  const queue = await loadQueue();
  const newQueue = queue.map((m) => {
    const payload = m.payload as Record<string, unknown>;
    if (payload && payload.id === tempId) {
      return {
        ...m,
        payload: { ...payload, id: realId },
      };
    }
    return m;
  });
  await saveQueue(newQueue);
}

function clearMemoryCache(): void {
  memoryCache = null;
}

export const mutationQueue = {
  add,
  remove,
  getAll,
  getCount,
  incrementRetry,
  clear,
  updateTempId,
  clearMemoryCache,
  subscribe,
};
