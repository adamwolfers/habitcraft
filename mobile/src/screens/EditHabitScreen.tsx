import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme';
import { useHabit, useUpdateHabit, useDeleteHabit } from '@/hooks';
import { MainStackParamList } from '@/types';

type EditHabitRouteProp = RouteProp<MainStackParamList, 'EditHabit'>;

const ICONS = ['🏃', '📚', '💪', '🧘', '💧', '🥗', '😴', '💰', '✍️', '🎯'];
const COLORS = [
  '#10b981',
  '#6366f1',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

export function EditHabitScreen() {
  const navigation = useNavigation();
  const route = useRoute<EditHabitRouteProp>();
  const { habitId } = route.params;

  const { data: habit, isLoading: isLoadingHabit } = useHabit(habitId);
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  // Populate form when habit loads - valid sync pattern
  useEffect(() => {
    if (habit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(habit.name);
      setDescription(habit.description || '');
      setSelectedIcon(habit.icon);
      setSelectedColor(habit.color);
    }
  }, [habit]);

  const handleUpdate = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Habit name is required');
      return;
    }

    try {
      await updateHabit.mutateAsync({
        id: habitId,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          icon: selectedIcon,
          color: selectedColor,
        },
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update habit');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Habit', 'Are you sure you want to delete this habit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHabit.mutateAsync(habitId);
            navigation.goBack();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete habit');
          }
        },
      },
    ]);
  };

  if (isLoadingHabit) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Morning Exercise"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={50}
          accessibilityLabel="Habit name"
          accessibilityHint="Edit the name of your habit"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What's this habit about?"
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={200}
          accessibilityLabel="Habit description, optional"
          accessibilityHint="Edit the description of your habit"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Icon</Text>
        <View style={styles.iconGrid}>
          {ICONS.map((icon) => (
            <TouchableOpacity
              key={icon}
              style={[styles.iconButton, selectedIcon === icon && styles.iconButtonSelected]}
              onPress={() => setSelectedIcon(icon)}
            >
              <Text style={styles.iconText}>{icon}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Color</Text>
        <View style={styles.colorGrid}>
          {COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorButton,
                { backgroundColor: color },
                selectedColor === color && styles.colorButtonSelected,
              ]}
              onPress={() => setSelectedColor(color)}
            >
              {selectedColor === color && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {error && (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      <TouchableOpacity
        testID="save-habit-button"
        style={[styles.updateButton, updateHabit.isPending && styles.buttonDisabled]}
        onPress={handleUpdate}
        disabled={updateHabit.isPending}
        accessibilityRole="button"
        accessibilityLabel={updateHabit.isPending ? 'Saving changes' : 'Save changes'}
        accessibilityState={{ disabled: updateHabit.isPending }}
      >
        {updateHabit.isPending ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.updateButtonText}>Save Changes</Text>
        )}
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
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  iconText: {
    fontSize: 24,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: colors.text,
  },
  checkmark: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  error: {
    color: colors.error,
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  updateButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    ...typography.button,
    color: colors.white,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteButtonText: {
    ...typography.button,
    color: colors.error,
  },
});

export default EditHabitScreen;
