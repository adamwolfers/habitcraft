import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SyncOnReconnect } from './SyncOnReconnect';
import { useNetwork } from '@/context/NetworkContext';
import { syncManager } from '@/lib/offline';
import { useQueryClient } from '@tanstack/react-query';

jest.mock('@/context/NetworkContext');
jest.mock('@/lib/offline');
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

const mockUseNetwork = useNetwork as jest.MockedFunction<typeof useNetwork>;
const mockSyncManager = syncManager as jest.Mocked<typeof syncManager>;
const mockUseQueryClient = useQueryClient as jest.MockedFunction<typeof useQueryClient>;

describe('SyncOnReconnect', () => {
  const mockInvalidateQueries = jest.fn();
  const mockQueryClient = {
    invalidateQueries: mockInvalidateQueries,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQueryClient.mockReturnValue(
      mockQueryClient as unknown as ReturnType<typeof useQueryClient>
    );
  });

  it('syncs when coming back online', async () => {
    let networkCallback: ((isOnline: boolean) => void) | null = null;
    mockUseNetwork.mockImplementation(() => {
      const [isOnline, setIsOnline] = React.useState(false);
      networkCallback = setIsOnline;
      return {
        isOnline,
        isInternetReachable: isOnline,
        refresh: jest.fn(),
      };
    });
    mockSyncManager.sync.mockResolvedValue({
      success: true,
      processedCount: 2,
      failedCount: 0,
      errors: [],
    });

    render(<SyncOnReconnect />);

    // Simulate coming back online
    await waitFor(() => {
      expect(networkCallback).not.toBeNull();
    });

    React.act(() => {
      networkCallback!(true);
    });

    await waitFor(() => {
      expect(mockSyncManager.sync).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['habits'] });
    });
  });

  it('does not sync when going offline', async () => {
    mockUseNetwork.mockReturnValue({
      isOnline: false,
      isInternetReachable: false,
      refresh: jest.fn(),
    });

    render(<SyncOnReconnect />);

    expect(mockSyncManager.sync).not.toHaveBeenCalled();
  });

  it('does not sync on initial online state', () => {
    mockUseNetwork.mockReturnValue({
      isOnline: true,
      isInternetReachable: true,
      refresh: jest.fn(),
    });

    render(<SyncOnReconnect />);

    expect(mockSyncManager.sync).not.toHaveBeenCalled();
  });

  it('handles sync errors gracefully', async () => {
    let networkCallback: ((isOnline: boolean) => void) | null = null;
    mockUseNetwork.mockImplementation(() => {
      const [isOnline, setIsOnline] = React.useState(false);
      networkCallback = setIsOnline;
      return {
        isOnline,
        isInternetReachable: isOnline,
        refresh: jest.fn(),
      };
    });
    mockSyncManager.sync.mockRejectedValue(new Error('Sync failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<SyncOnReconnect />);

    await waitFor(() => {
      expect(networkCallback).not.toBeNull();
    });

    React.act(() => {
      networkCallback!(true);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Sync failed:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});
