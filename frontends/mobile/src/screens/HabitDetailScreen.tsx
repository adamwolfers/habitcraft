import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme';
import { MainStackParamList } from '@/types';

type HabitDetailRouteProp = RouteProp<MainStackParamList, 'HabitDetail'>;

export function HabitDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<HabitDetailRouteProp>();
  const { habitId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Habit Details</Text>
      <Text style={styles.subtitle}>Viewing habit: {habitId}</Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Back</Text>
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

export default HabitDetailScreen;
