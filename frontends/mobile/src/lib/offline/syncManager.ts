import { mutationQueue } from './mutationQueue';
import { networkStatus } from './networkStatus';
import { habitsApi } from '@/lib/habits';
import { QueuedMutation, SyncResult, SyncError } from './types';

const MAX_RETRIES = 3;
const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404, 409, 422];

let syncing = false;

interface ApiError extends Error {
  response?: {
    status: number;
  };
}

function isRetryableError(error: unknown): boolean {
  const apiError = error as ApiError;
  if (apiError.response?.status) {
    return !NON_RETRYABLE_STATUS_CODES.includes(apiError.response.status);
  }
  // Network errors are retryable
  return true;
}

async function processMutation(mutation: QueuedMutation): Promise<{ serverId?: string }> {
  const payload = mutation.payload as Record<string, unknown>;

  switch (mutation.type) {
    case 'createHabit': {
      const result = await habitsApi.createHabit(
        payload as Parameters<typeof habitsApi.createHabit>[0]
      );
      return { serverId: result.id };
    }
    case 'updateHabit': {
      const { id, data } = payload as { id: string; data: Parameters<typeof habitsApi.updateHabit>[1] };
      await habitsApi.updateHabit(id, data);
      return {};
    }
    case 'deleteHabit': {
      const { id } = payload as { id: string };
      await habitsApi.deleteHabit(id);
      return {};
    }
    case 'completeHabit': {
      const { id, data } = payload as { id: string; data: Parameters<typeof habitsApi.completeHabit>[1] };
      await habitsApi.completeHabit(id, data);
      return {};
    }
    case 'uncompleteHabit': {
      const { id, completedDate } = payload as { id: string; completedDate: string };
      await habitsApi.uncompleteHabit(id, completedDate);
      return {};
    }
    default:
      throw new Error(`Unknown mutation type: ${mutation.type}`);
  }
}

async function sync(): Promise<SyncResult> {
  const isOnline = await networkStatus.isOnline();

  if (!isOnline) {
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  syncing = true;
  const errors: SyncError[] = [];
  let processedCount = 0;
  let failedCount = 0;

  try {
    const mutations = await mutationQueue.getAll();

    // Sort by timestamp to process in order
    const sortedMutations = [...mutations].sort((a, b) => a.timestamp - b.timestamp);

    for (const mutation of sortedMutations) {
      try {
        const result = await processMutation(mutation);

        // Update temp IDs for subsequent mutations
        if (mutation.tempId && result.serverId) {
          await mutationQueue.updateTempId(mutation.tempId, result.serverId);
        }

        await mutationQueue.remove(mutation.id);
        processedCount++;
      } catch (error) {
        const isRetryable = isRetryableError(error);
        const hasRetriesLeft = mutation.retryCount < MAX_RETRIES;

        if (isRetryable && hasRetriesLeft) {
          await mutationQueue.incrementRetry(mutation.id);
        } else {
          await mutationQueue.remove(mutation.id);
        }

        failedCount++;
        errors.push({
          mutationId: mutation.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          isRetryable: isRetryable && hasRetriesLeft,
        });
      }
    }
  } finally {
    syncing = false;
  }

  return {
    success: failedCount === 0,
    processedCount,
    failedCount,
    errors,
  };
}

function isSyncing(): boolean {
  return syncing;
}

export const syncManager = {
  sync,
  isSyncing,
};
