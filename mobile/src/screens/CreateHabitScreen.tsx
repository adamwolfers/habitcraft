import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { schemaLimits } from '@/types/apiLimits.generated';
import { colors, spacing, typography } from '@/theme';
import { useCreateHabit } from '@/hooks';

// From the spec, not literals (habitcraft-467). These used to read 50 and 200
// against a server that has always accepted 100 and 500, so a mobile user's
// keystrokes simply stopped with no error (habitcraft-34d.3).
const NAME_MAX_LENGTH = schemaLimits.HabitInput.name.maxLength;
const DESCRIPTION_MAX_LENGTH = schemaLimits.HabitInput.description.maxLength;

const ICONS = ['🏃', '📚', '💪', '🧘', '💧', '🥗', '😴', '💰', '✍️', '🎯'];
const COLORS = [
  '#10b981', // green
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
];

export function CreateHabitScreen() {
  const navigation = useNavigation();
  const createHabit = useCreateHabit();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Habit name is required');
      return;
    }

    try {
      await createHabit.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: selectedIcon,
        color: selectedColor,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create habit');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          testID="habit-name-input"
          style={styles.input}
          placeholder="e.g., Morning Exercise"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX_LENGTH}
          accessibilityLabel="Habit name"
          accessibilityHint="Enter a name for your habit"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          testID="habit-description-input"
          style={[styles.input, styles.textArea]}
          placeholder="What's this habit about?"
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={DESCRIPTION_MAX_LENGTH}
          accessibilityLabel="Habit description, optional"
          accessibilityHint="Enter a description for your habit"
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
        <Text
          testID="create-habit-error"
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}

      <TouchableOpacity
        testID="create-habit-button"
        style={[styles.createButton, createHabit.isPending && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={createHabit.isPending}
        accessibilityRole="button"
        accessibilityLabel={createHabit.isPending ? 'Creating habit' : 'Create habit'}
        accessibilityState={{ disabled: createHabit.isPending }}
      >
        {createHabit.isPending ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.createButtonText}>Create Habit</Text>
        )}
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
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    ...typography.button,
    color: colors.white,
  },
});

export default CreateHabitScreen;
