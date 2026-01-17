// Offline support types

export type MutationType =
  | 'createHabit'
  | 'updateHabit'
  | 'deleteHabit'
  | 'completeHabit'
  | 'uncompleteHabit';

export interface QueuedMutation {
  id: string;
  type: MutationType;
  payload: unknown;
  timestamp: number;
  retryCount: number;
  tempId?: string; // For offline creates, maps to server ID after sync
}

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

export interface SyncResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: SyncError[];
}

export interface SyncError {
  mutationId: string;
  error: string;
  isRetryable: boolean;
}

export interface OfflineStorageData {
  mutationQueue: QueuedMutation[];
  lastSyncTimestamp: number | null;
}
