import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { MainTabNavigator } from './MainTabNavigator';
import { CreateHabitScreen, EditHabitScreen, HabitDetailScreen } from '@/screens';
import { MainStackParamList } from '@/types';
import { colors } from '@/theme';

const Stack = createStackNavigator<MainStackParamList>();

export function MainStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="Tabs"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateHabit"
        component={CreateHabitScreen}
        options={{
          title: 'New Habit',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="EditHabit"
        component={EditHabitScreen}
        options={{
          title: 'Edit Habit',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="HabitDetail"
        component={HabitDetailScreen}
        options={{
          title: 'Habit Details',
        }}
      />
    </Stack.Navigator>
  );
}
