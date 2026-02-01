import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Habit } from '@/types';
import { colors, spacing, typography } from '@/theme';

interface HabitCardProps {
  habit: Habit;
  onPress: (habit: Habit) => void;
  onComplete: (habitId: string) => void;
  isCompletedToday?: boolean;
}

function formatFrequency(frequency: string): string {
  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

function isPendingSync(habitId: string): boolean {
  return habitId.startsWith('temp-');
}

export function HabitCard({
  habit,
  onPress,
  onComplete,
  isCompletedToday = false,
}: HabitCardProps) {
  return (
    <TouchableOpacity
      testID="habit-card"
      style={[styles.card, { borderLeftColor: habit.color }]}
      onPress={() => onPress(habit)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${habit.name} habit, ${formatFrequency(habit.frequency)}`}
      accessibilityHint="Double tap to view details"
    >
      <TouchableOpacity
        testID="complete-button"
        style={[
          styles.completeButton,
          isCompletedToday && styles.completeButtonActive,
          { borderColor: habit.color },
        ]}
        onPress={() => onComplete(habit.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompletedToday }}
        accessibilityLabel={`Mark ${habit.name} as ${isCompletedToday ? 'incomplete' : 'complete'}`}
        accessibilityHint={isCompletedToday ? 'Double tap to uncheck' : 'Double tap to check'}
      >
        {isCompletedToday && (
          <Text style={[styles.checkmark, { color: habit.color }]}>✓</Text>
        )}
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.icon}>{habit.icon}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {habit.name}
          </Text>
        </View>

        {habit.description && (
          <Text style={styles.description} numberOfLines={2}>
            {habit.description}
          </Text>
        )}

        <View style={styles.footer}>
          <View style={[styles.frequencyBadge, { backgroundColor: habit.color + '20' }]}>
            <Text style={[styles.frequencyText, { color: habit.color }]}>
              {formatFrequency(habit.frequency)}
            </Text>
          </View>
          {isPendingSync(habit.id) && (
            <View
              style={styles.pendingBadge}
              testID="pending-badge"
              accessibilityLabel="Pending sync"
              accessibilityRole="text"
            >
              <Text style={styles.pendingText}>Pending sync</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  completeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  completeButtonActive: {
    backgroundColor: colors.surface,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  icon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  name: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frequencyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 4,
  },
  frequencyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 4,
    backgroundColor: colors.warningLight,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.warning,
  },
});
