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
    // Initial fetch on mount - valid initialization pattern
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Mount reads the count once; this keeps it current while the screen stays
  // mounted under the create modal or a completion tap (habitcraft-bqhe.24).
  useEffect(() => mutationQueue.subscribe(setCount), []);

  return {
    count,
    hasPending: count > 0,
    refresh,
  };
}
