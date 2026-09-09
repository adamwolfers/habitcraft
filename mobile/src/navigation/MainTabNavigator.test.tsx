import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MainTabNavigator } from './MainTabNavigator';

// The screens are stubbed rather than rendered. DashboardScreen reaches the
// '@/components' barrel, which pulls react-native-reanimated and dies at import
// under jest (habitcraft-ma03); nothing in this file is about what the tabs
// contain.
jest.mock('@/screens', () => {
  const { View } = require('react-native');
  return {
    DashboardScreen: () => <View testID="stub-dashboard" />,
    ProfileScreen: () => <View testID="stub-profile" />,
  };
});

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderTabs() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

describe('MainTabNavigator', () => {
  // Both tabs carry a testID because their labels are not unique on screen.
  // ProfileScreen renders its own 'Profile' heading, so once a test is on that
  // screen a by.text('Profile') matcher finds the tab AND the heading and the
  // E2E suite fails with 'Multiple elements found' (habitcraft-bqhe.14).
  it('gives the Dashboard tab a testID the E2E suite can target', () => {
    const { getByTestId } = renderTabs();

    expect(getByTestId('tab-dashboard')).toBeTruthy();
  });

  it('gives the Profile tab a testID the E2E suite can target', () => {
    const { getByTestId } = renderTabs();

    expect(getByTestId('tab-profile')).toBeTruthy();
  });
});
