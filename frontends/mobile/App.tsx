import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { NavigationContainer } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { StyleSheet } from 'react-native';

import { AuthProvider, NetworkProvider } from './src/context';
import { RootNavigator } from './src/navigation';
import { createFilePersister } from './src/lib/offline';
import { SyncOnReconnect } from './src/components';

// Create a client for React Query with offline support
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep cache for offline
      retry: 2,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

// Persister for React Query cache
const persister = createFilePersister('query-cache');

const persistOptions = {
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
};

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <NetworkProvider>
            <SyncOnReconnect />
            <AuthProvider>
              <NavigationContainer>
                <StatusBar style="auto" />
                <RootNavigator />
                <Toast />
              </NavigationContainer>
            </AuthProvider>
          </NetworkProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
