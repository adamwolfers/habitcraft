import React from 'react';
import { render } from '@testing-library/react-native';
import { OfflineBanner } from './OfflineBanner';
import { useNetwork } from '@/context/NetworkContext';

jest.mock('@/context/NetworkContext');

const mockUseNetwork = useNetwork as jest.MockedFunction<typeof useNetwork>;

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when online', () => {
    mockUseNetwork.mockReturnValue({
      isOnline: true,
      isInternetReachable: true,
      refresh: jest.fn(),
    });

    const { queryByTestId } = render(<OfflineBanner />);

    expect(queryByTestId('offline-banner')).toBeNull();
  });

  it('renders banner when offline', () => {
    mockUseNetwork.mockReturnValue({
      isOnline: false,
      isInternetReachable: false,
      refresh: jest.fn(),
    });

    const { getByTestId, getByText } = render(<OfflineBanner />);

    expect(getByTestId('offline-banner')).toBeTruthy();
    expect(getByText("You're offline")).toBeTruthy();
  });

  it('shows helpful message about offline mode', () => {
    mockUseNetwork.mockReturnValue({
      isOnline: false,
      isInternetReachable: false,
      refresh: jest.fn(),
    });

    const { getByText } = render(<OfflineBanner />);

    expect(getByText('Changes will sync when you reconnect')).toBeTruthy();
  });
});
