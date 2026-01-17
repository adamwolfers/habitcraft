import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AuthNavigator } from './AuthNavigator';
import { MainStackNavigator } from './MainStackNavigator';
import { useAuthContext } from '@/context/AuthContext';
import { RootStackParamList } from '@/types';
import { colors } from '@/theme';

const Stack = createStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainStackNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
