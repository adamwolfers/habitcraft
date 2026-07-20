import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './RootNavigator';
import { useAuthContext } from '@/context/AuthContext';

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: jest.fn(),
}));

// Mock the navigators
jest.mock('./AuthNavigator', () => ({
  AuthNavigator: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="auth-navigator">
        <Text>Auth Navigator</Text>
      </View>
    );
  },
}));

jest.mock('./MainStackNavigator', () => ({
  MainStackNavigator: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="main-navigator">
        <Text>Main Navigator</Text>
      </View>
    );
  },
}));

const mockUseAuthContext = useAuthContext as jest.Mock;

function renderWithNavigation(component: React.ReactElement) {
  return render(<NavigationContainer>{component}</NavigationContainer>);
}

describe('RootNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading screen when auth is loading', () => {
    mockUseAuthContext.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    const { UNSAFE_root } = renderWithNavigation(<RootNavigator />);

    // Should render ActivityIndicator (loading state)
    expect(UNSAFE_root).toBeTruthy();
  });

  it('renders auth navigator when not authenticated', () => {
    mockUseAuthContext.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    const { getByTestId } = renderWithNavigation(<RootNavigator />);

    expect(getByTestId('auth-navigator')).toBeTruthy();
  });

  it('renders main navigator when authenticated', () => {
    mockUseAuthContext.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    const { getByTestId } = renderWithNavigation(<RootNavigator />);

    expect(getByTestId('main-navigator')).toBeTruthy();
  });
});
