import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { DashboardScreen, ProfileScreen } from '@/screens';
import { MainTabParamList } from '@/types';
import { colors } from '@/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Simple text-based icons for now (can be replaced with proper icons later)
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '🏠',
    Profile: '👤',
  };

  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name] || '•'}</Text>;
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
      })}
    >
      {/*
        The testIDs exist so the E2E suite never has to tap a tab by its label.
        A tab's label is not unique on screen -- ProfileScreen renders its own
        'Profile' heading, so by.text('Profile') matches the tab AND the heading
        the moment a test is already on that screen, and Detox fails with
        'Multiple elements found' rather than anything about the behaviour under
        test (habitcraft-bqhe.14).
      */}
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarButtonTestID: 'tab-dashboard' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarButtonTestID: 'tab-profile' }}
      />
    </Tab.Navigator>
  );
}
