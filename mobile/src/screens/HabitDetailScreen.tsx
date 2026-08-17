import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, typography } from '@/theme';
import { useHabit, useDeleteHabit } from '@/hooks';
import { MainStackParamList } from '@/types';

type HabitDetailRouteProp = RouteProp<MainStackParamList, 'HabitDetail'>;
type HabitDetailNavigationProp = StackNavigationProp<MainStackParamList>;

export function HabitDetailScreen() {
  const navigation = useNavigation<HabitDetailNavigationProp>();
  const route = useRoute<HabitDetailRouteProp>();
  const { habitId } = route.params;

  const { data: habit, isLoading, isError, refetch } = useHabit(habitId);
  const deleteHabit = useDeleteHabit();

  const handleEdit = () => {
    navigation.navigate('EditHabit', { habitId });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Habit',
      'Are you sure you want to delete this habit? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHabit.mutateAsync(habitId);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Failed to delete habit. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator testID="loading-indicator" size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !habit) {
    return (
      <View testID="error-state" style={styles.centered}>
        <Text style={styles.errorText}>Failed to load habit</Text>
        <TouchableOpacity
          testID="retry-button"
          style={styles.retryButton}
          onPress={() => refetch()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: habit.color + '20' }]}>
        <Text style={styles.icon}>{habit.icon}</Text>
        <Text style={styles.name}>{habit.name}</Text>
      </View>

      {habit.description ? (
        <Text testID="habit-description" style={styles.description}>
          {habit.description}
        </Text>
      ) : null}

      <Text style={styles.createdAt}>Created {new Date(habit.createdAt).toLocaleDateString()}</Text>

      <TouchableOpacity
        testID="edit-habit-button"
        style={styles.editButton}
        onPress={handleEdit}
        accessibilityRole="button"
        accessibilityLabel="Edit habit"
      >
        <Text style={styles.editButtonText}>Edit Habit</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="delete-habit-button"
        style={[styles.deleteButton, deleteHabit.isPending && styles.buttonDisabled]}
        onPress={handleDelete}
        disabled={deleteHabit.isPending}
        accessibilityRole="button"
        accessibilityLabel="Delete habit"
        accessibilityHint="Double tap to permanently delete this habit"
        accessibilityState={{ disabled: deleteHabit.isPending }}
      >
        <Text style={styles.deleteButtonText}>Delete Habit</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    borderRadius: 12,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  createdAt: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xl,
  },
  editButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  editButtonText: {
    ...typography.button,
    color: colors.white,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    ...typography.button,
    color: colors.error,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.white,
  },
});

export default HabitDetailScreen;
