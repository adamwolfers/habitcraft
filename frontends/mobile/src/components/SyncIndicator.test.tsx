import React from 'react';
import { render } from '@testing-library/react-native';
import { SyncIndicator } from './SyncIndicator';
import { usePendingMutations } from '@/hooks/usePendingMutations';

jest.mock('@/hooks/usePendingMutations');

const mockUsePendingMutations = usePendingMutations as jest.MockedFunction<typeof usePendingMutations>;

describe('SyncIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no pending mutations', () => {
    mockUsePendingMutations.mockReturnValue({
      count: 0,
      hasPending: false,
      refresh: jest.fn(),
    });

    const { queryByTestId } = render(<SyncIndicator />);

    expect(queryByTestId('sync-indicator')).toBeNull();
  });

  it('renders indicator when there are pending mutations', () => {
    mockUsePendingMutations.mockReturnValue({
      count: 3,
      hasPending: true,
      refresh: jest.fn(),
    });

    const { getByTestId, getByText } = render(<SyncIndicator />);

    expect(getByTestId('sync-indicator')).toBeTruthy();
    expect(getByText('3 pending')).toBeTruthy();
  });

  it('shows singular text for 1 pending mutation', () => {
    mockUsePendingMutations.mockReturnValue({
      count: 1,
      hasPending: true,
      refresh: jest.fn(),
    });

    const { getByText } = render(<SyncIndicator />);

    expect(getByText('1 pending')).toBeTruthy();
  });
});
