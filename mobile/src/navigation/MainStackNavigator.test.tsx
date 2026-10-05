import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MainStackNavigator } from './MainStackNavigator';

// The screens are stubbed rather than rendered; nothing in this file is about
// what they contain. The Tabs stub is only a way to push HabitDetail.
jest.mock('./MainTabNavigator', () => {
  const { Pressable } = require('react-native');
  const { useNavigation } = require('@react-navigation/native');
  return {
    MainTabNavigator: () => {
      const navigation = useNavigation();
      return (
        <Pressable
          testID="stub-open-detail"
          onPress={() => navigation.navigate('HabitDetail', { habitId: 'h1' })}
        />
      );
    },
  };
});

jest.mock('@/screens', () => {
  const { View } = require('react-native');
  return {
    CreateHabitScreen: () => <View testID="stub-create" />,
    EditHabitScreen: () => <View testID="stub-edit" />,
    HabitDetailScreen: () => <View testID="stub-detail" />,
  };
});

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderStack() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <NavigationContainer>
        <MainStackNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

describe('MainStackNavigator', () => {
  // The E2E suite leaves Habit Details by tapping this button. Its only other
  // way out was device.pressBack(), which Detox implements on Android only
  // (habitcraft-bqhe.8).
  it('gives the Habit Details back button a testID the E2E suite can target', async () => {
    const { getByTestId, findByTestId } = renderStack();

    fireEvent.press(getByTestId('stub-open-detail'));

    expect(await findByTestId('habit-detail-back-button')).toBeTruthy();
  });
});
