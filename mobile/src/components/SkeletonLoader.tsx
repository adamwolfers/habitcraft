import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { colors, spacing } from '@/theme';

/**
 * Base skeleton component with shimmer animation
 */
function SkeletonBox({
  width,
  height,
  borderRadius = 4,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
  }));

  return (
    <Animated.View
      style={[styles.skeleton, { width, height, borderRadius }, animatedStyle, style]}
    />
  );
}

/**
 * Skeleton placeholder for a single habit card
 */
export function HabitCardSkeleton() {
  return (
    <View style={styles.card} accessibilityLabel="Loading habit" accessibilityRole="none">
      {/* Checkbox */}
      <SkeletonBox width={32} height={32} borderRadius={16} />

      {/* Content */}
      <View style={styles.content}>
        {/* Header row with icon and name */}
        <View style={styles.header}>
          <SkeletonBox width={24} height={24} borderRadius={4} />
          <SkeletonBox width="70%" height={20} style={{ marginLeft: spacing.sm }} />
        </View>

        {/* Description */}
        <SkeletonBox width="90%" height={14} style={{ marginTop: spacing.xs }} />
      </View>
    </View>
  );
}

/**
 * Skeleton placeholder for the dashboard loading state
 */
export function DashboardSkeleton() {
  return (
    <View style={styles.dashboard} accessibilityLabel="Loading habits" accessibilityRole="none">
      <HabitCardSkeleton />
      <HabitCardSkeleton />
      <HabitCardSkeleton />
      <HabitCardSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.border,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
  },
  content: {
    flex: 1,
    marginLeft: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dashboard: {
    paddingHorizontal: spacing.lg,
  },
});
