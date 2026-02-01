import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePendingMutations } from '@/hooks/usePendingMutations';
import { colors } from '@/theme';

export function SyncIndicator(): React.ReactElement | null {
  const { count, hasPending } = usePendingMutations();

  if (!hasPending) {
    return null;
  }

  return (
    <View
      style={styles.container}
      testID="sync-indicator"
      accessibilityRole="text"
      accessibilityLabel={`${count} ${count === 1 ? 'change' : 'changes'} pending sync`}
    >
      <View style={styles.badge}>
        <Text style={styles.text}>{count} pending</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    color: colors.info,
    fontSize: 12,
    fontWeight: '500',
  },
});
