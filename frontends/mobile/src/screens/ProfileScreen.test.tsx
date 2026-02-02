import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from './ProfileScreen';
import { useAuthContext } from '@/context/AuthContext';

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: jest.fn(),
}));

const mockUseAuthContext = useAuthContext as jest.Mock;

describe('ProfileScreen', () => {
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile screen with user email', () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      logout: mockLogout,
    });

    const { getByTestId, getByText } = render(<ProfileScreen />);

    expect(getByTestId('profile-screen')).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
    expect(getByTestId('profile-email')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
  });

  it('renders without email when user is null', () => {
    mockUseAuthContext.mockReturnValue({
      user: null,
      logout: mockLogout,
    });

    const { getByTestId, getByText, queryByTestId } = render(<ProfileScreen />);

    expect(getByTestId('profile-screen')).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
    expect(queryByTestId('profile-email')).toBeNull();
  });

  it('renders logout button', () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      logout: mockLogout,
    });

    const { getByTestId, getByText } = render(<ProfileScreen />);

    expect(getByTestId('logout-button')).toBeTruthy();
    expect(getByText('Log Out')).toBeTruthy();
  });

  it('calls logout when button is pressed', async () => {
    mockLogout.mockResolvedValue(undefined);
    mockUseAuthContext.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      logout: mockLogout,
    });

    const { getByTestId } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('logout-button'));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('has correct accessibility attributes on logout button', () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      logout: mockLogout,
    });

    const { getByTestId } = render(<ProfileScreen />);

    const button = getByTestId('logout-button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Log out');
  });
});
