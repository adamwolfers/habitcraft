import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { networkStatus } from '@/lib/offline/networkStatus';
import { NetworkState } from '@/lib/offline/types';

interface NetworkContextValue {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  refresh: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

interface NetworkProviderProps {
  children: React.ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: null,
  });

  const refresh = useCallback(async () => {
    const newState = await networkStatus.fetch();
    setState(newState);
  }, []);

  useEffect(() => {
    // Fetch initial state
    refresh();

    // Subscribe to changes
    const unsubscribe = networkStatus.subscribe((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, [refresh]);

  const isOnline = state.isConnected && state.isInternetReachable !== false;

  const value: NetworkContextValue = {
    isOnline,
    isInternetReachable: state.isInternetReachable,
    refresh,
  };

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
