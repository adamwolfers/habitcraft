import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNetwork } from '@/context/NetworkContext';
import { syncManager } from '@/lib/offline';

export function SyncOnReconnect(): null {
  const { isOnline } = useNetwork();
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      return;
    }

    // Only sync if we were previously offline
    if (wasOffline.current) {
      wasOffline.current = false;

      const performSync = async () => {
        try {
          const result = await syncManager.sync();

          if (result.processedCount > 0) {
            // Invalidate habits query to fetch fresh data
            queryClient.invalidateQueries({ queryKey: ['habits'] });
          }

          if (result.errors.length > 0) {
            console.warn('Sync completed with errors:', result.errors);
          }
        } catch (error) {
          console.error('Sync failed:', error);
        }
      };

      performSync();
    }
  }, [isOnline, queryClient]);

  return null;
}
