import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

type WelcomeNavigation = StackNavigationProp<AuthStackParamList, 'Welcome'>;

/**
 * The auth stack's front door.
 *
 * Login used to be the initial route, which meant a first-time user landed in
 * a form built for somebody else and had to find a link at the bottom to get
 * out of it. Signing up and logging in are equally likely here, so they get
 * equal weight.
 */
export function WelcomeScreen() {
  const navigation = useNavigation<WelcomeNavigation>();

  return (
    <View testID="welcome-screen" style={styles.container}>
      <View style={styles.brand}>
        <Text style={styles.logo}>🎯</Text>
        <Text style={styles.title}>HabitCraft</Text>
        <Text style={styles.subtitle}>Track your habits, build your future</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          testID="welcome-signup-button"
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Register')}
          accessibilityRole="button"
          accessibilityLabel="Get started"
          accessibilityHint="Double tap to create a new account"
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="welcome-login-button"
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="button"
          accessibilityLabel="Log in"
          accessibilityHint="Double tap to log in to an existing account"
        >
          <Text style={styles.secondaryButtonText}>Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: 400,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.primary,
  },
});

export default WelcomeScreen;
