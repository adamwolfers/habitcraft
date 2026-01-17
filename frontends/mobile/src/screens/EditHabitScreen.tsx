import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme';
import { MainStackParamList } from '@/types';

type EditHabitRouteProp = RouteProp<MainStackParamList, 'EditHabit'>;

export function EditHabitScreen() {
  const navigation = useNavigation();
  const route = useRoute<EditHabitRouteProp>();
  const { habitId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Habit</Text>
      <Text style={styles.subtitle}>Editing habit: {habitId}</Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Close</Text>
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
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
  },
});

export default EditHabitScreen;
