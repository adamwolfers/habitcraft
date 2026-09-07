import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { WelcomeScreen, LoginScreen, RegisterScreen } from '@/screens';
import { AuthStackParamList } from '@/types';

const Stack = createStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}
