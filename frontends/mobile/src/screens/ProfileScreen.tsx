import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { useAuthContext } from '@/context/AuthContext';

export function ProfileScreen() {
  const { user, logout } = useAuthContext();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View testID="profile-screen" style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {user && (
        <Text testID="profile-email" style={styles.email}>
          {user.email}
        </Text>
      )}

      <TouchableOpacity
        testID="logout-button"
        style={styles.logoutButton}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Log out"
        accessibilityHint="Double tap to sign out of your account"
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  email: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  logoutButton: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  logoutText: {
    ...typography.button,
    color: colors.white,
  },
});

export default ProfileScreen;
