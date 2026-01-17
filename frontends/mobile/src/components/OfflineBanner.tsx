import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetwork } from '@/context/NetworkContext';
import { colors } from '@/theme';

export function OfflineBanner(): React.ReactElement | null {
  const { isOnline } = useNetwork();

  if (isOnline) {
    return null;
  }

  return (
    <View style={styles.container} testID="offline-banner">
      <Text style={styles.title}>You're offline</Text>
      <Text style={styles.subtitle}>Changes will sync when you reconnect</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warningLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
  },
  title: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
