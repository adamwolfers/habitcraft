import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { format } from 'date-fns';
import { colors, spacing, typography } from '@/theme';
import { useHabits, useCompleteHabit, useUncompleteHabit } from '@/hooks';
import { HabitCard, OfflineBanner, SyncIndicator } from '@/components';
import { DashboardSkeleton } from '@/components/SkeletonLoader';
import { Habit, MainStackParamList } from '@/types';

type DashboardNavigationProp = StackNavigationProp<MainStackParamList>;

function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigationProp>();
  const { data: habits, isLoading, error, refetch, isRefetching } = useHabits();
  const completeHabit = useCompleteHabit();
  const uncompleteHabit = useUncompleteHabit();

  const today = getTodayDateString();

  const handleHabitPress = (habit: Habit) => {
    navigation.navigate('HabitDetail', { habitId: habit.id });
  };

  const handleComplete = (habitId: string) => {
    const habit = habits?.find((h) => h.id === habitId);
    const isCompleted = habit?.completions.some((c) => c.completed_date === today);
    if (isCompleted) {
      uncompleteHabit.mutate({ id: habitId, completedDate: today });
    } else {
      completeHabit.mutate({ id: habitId, data: { date: today } });
    }
  };

  const handleCreateHabit = () => {
    navigation.navigate('CreateHabit');
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
        </View>
        <DashboardSkeleton />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered} accessibilityRole="alert">
        <Text style={styles.errorText}>Failed to load habits</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          accessibilityHint="Double tap to reload habits"
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View testID="dashboard-screen" style={styles.container}>
      <OfflineBanner />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Today</Text>
          <SyncIndicator />
        </View>
        <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>

      <FlatList
        testID="habit-list"
        data={habits?.filter((h) => h.status !== 'archived') || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HabitCard
            habit={item}
            onPress={handleHabitPress}
            onComplete={handleComplete}
            isCompletedToday={item.completions.some((c) => c.completed_date === today)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View testID="empty-state" style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyText}>
              Create your first habit to start tracking your progress
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        testID="create-habit-fab"
        style={styles.fab}
        onPress={handleCreateHabit}
        accessibilityRole="button"
        accessibilityLabel="Create new habit"
        accessibilityHint="Double tap to add a new habit"
      >
        <Text style={styles.fabIcon} accessibilityElementsHidden>
          +
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  date: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100, // Space for FAB
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  retryText: {
    ...typography.button,
    color: colors.white,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabIcon: {
    fontSize: 32,
    color: colors.white,
    lineHeight: 32,
  },
});

export default DashboardScreen;
