import { useState, useEffect, useCallback } from 'react';
import { mutationQueue } from '@/lib/offline/mutationQueue';

interface UsePendingMutationsResult {
  count: number;
  hasPending: boolean;
  refresh: () => Promise<void>;
}

export function usePendingMutations(): UsePendingMutationsResult {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const pendingCount = await mutationQueue.getCount();
      setCount(pendingCount);
    } catch (error) {
      console.error('usePendingMutations.refresh error:', error);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    count,
    hasPending: count > 0,
    refresh,
  };
}
