import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { NetworkProvider, useNetwork } from './NetworkContext';
import { networkStatus } from '@/lib/offline/networkStatus';

jest.mock('@/lib/offline/networkStatus');

const mockNetworkStatus = networkStatus as jest.Mocked<typeof networkStatus>;

function TestConsumer() {
  const { isOnline, isInternetReachable } = useNetwork();
  return (
    <Text testID="status">
      {`${isOnline ? 'online' : 'offline'}|${String(isInternetReachable)}`}
    </Text>
  );
}

describe('NetworkContext', () => {
  let mockUnsubscribe: jest.Mock;
  let capturedCallback: ((state: { isConnected: boolean; isInternetReachable: boolean | null }) => void) | null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe = jest.fn();
    capturedCallback = null;

    mockNetworkStatus.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    mockNetworkStatus.subscribe.mockImplementation((callback) => {
      capturedCallback = callback;
      return mockUnsubscribe;
    });
  });

  it('provides initial online state', async () => {
    const { getByTestId } = render(
      <NetworkProvider>
        <TestConsumer />
      </NetworkProvider>
    );

    await waitFor(() => {
      expect(getByTestId('status').props.children).toBe('online|true');
    });
  });

  it('provides initial offline state', async () => {
    mockNetworkStatus.fetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    const { getByTestId } = render(
      <NetworkProvider>
        <TestConsumer />
      </NetworkProvider>
    );

    await waitFor(() => {
      expect(getByTestId('status').props.children).toBe('offline|false');
    });
  });

  it('updates state when network changes', async () => {
    const { getByTestId } = render(
      <NetworkProvider>
        <TestConsumer />
      </NetworkProvider>
    );

    await waitFor(() => {
      expect(getByTestId('status').props.children).toBe('online|true');
    });

    await act(async () => {
      capturedCallback!({
        isConnected: false,
        isInternetReachable: false,
      });
    });

    expect(getByTestId('status').props.children).toBe('offline|false');
  });

  it('subscribes on mount and unsubscribes on unmount', async () => {
    const { unmount } = render(
      <NetworkProvider>
        <TestConsumer />
      </NetworkProvider>
    );

    await waitFor(() => {
      expect(mockNetworkStatus.subscribe).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('throws error when useNetwork is used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => render(<TestConsumer />)).toThrow(
      'useNetwork must be used within a NetworkProvider'
    );

    consoleSpy.mockRestore();
  });

  it('handles null isInternetReachable', async () => {
    mockNetworkStatus.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: null,
    });

    const { getByTestId } = render(
      <NetworkProvider>
        <TestConsumer />
      </NetworkProvider>
    );

    await waitFor(() => {
      expect(getByTestId('status').props.children).toBe('online|null');
    });
  });
});
