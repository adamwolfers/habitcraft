import { Habit } from "@/types/habit";

export interface HabitFormValues {
  name: string;
  description: string;
  color: string;
  icon: string;
}

export interface HabitUpdatePayload {
  name: string;
  description: string | null;
  frequency: "daily" | "weekly";
  color: string;
  icon: string;
}

/**
 * Detects whether any habit fields have changed between form values and original habit.
 * Handles null description in original habit by comparing to empty string.
 */
export function detectHabitChanges(
  formValues: HabitFormValues,
  originalHabit: Habit
): boolean {
  const trimmedName = formValues.name.trim();
  const trimmedDescription = formValues.description.trim();
  const originalDescription = originalHabit.description || "";

  const nameChanged = trimmedName !== originalHabit.name;
  const descriptionChanged = trimmedDescription !== originalDescription;
  const colorChanged = formValues.color !== originalHabit.color;
  const iconChanged = formValues.icon !== originalHabit.icon;

  return nameChanged || descriptionChanged || colorChanged || iconChanged;
}

/**
 * Builds the update payload for a habit from form values.
 * Trims whitespace and converts empty description to null.
 */
export function buildHabitUpdatePayload(
  formValues: HabitFormValues,
  originalHabit: Habit
): HabitUpdatePayload {
  const trimmedName = formValues.name.trim();
  const trimmedDescription = formValues.description.trim();

  return {
    name: trimmedName,
    description: trimmedDescription || null,
    frequency: originalHabit.frequency,
    color: formValues.color,
    icon: formValues.icon,
  };
}

export const PRESET_COLORS = [
  // Row 1
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  // Row 2
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#eab308', // yellow
  '#f43f5e', // rose
  '#84cc16', // lime
  '#0ea5e9', // sky
  '#22c55e', // emerald
  '#64748b', // slate
];

export const PRESET_ICONS = [
  // Row 1: Fitness & Health
  '🏃', // running/exercise
  '📚', // reading/learning
  '🧘', // meditation/yoga
  '💧', // water/hydration
  '🥗', // healthy eating
  '💪', // strength/fitness
  '🎯', // goals/targets
  '✍️', // writing/journaling
  // Row 2: Daily Activities
  '😴', // sleep/rest
  '🚶', // walking
  '🎨', // creative/art
  '🎵', // music practice
  '🧹', // cleaning/organizing
  '💻', // coding/work
  '🌱', // gardening/plants
  '🙏', // gratitude/prayer
  // Row 3: Wellness & Routines
  '☕', // morning routine
  '🚫', // quit bad habit
  '📱', // limit screen time
  '🎮', // gaming/hobbies
  '🧠', // learning/brain
  '💊', // medication/vitamins
  '🦷', // dental care
  '🌙', // evening routine
  // Row 4: Outdoor Activities
  '🥾', // hiking
  '🌲', // forest/trees
  '🏞️', // national park/lake
  '🛤️', // trail
  '⛰️', // mountain
  '🏕️', // camping
  '🚴', // cycling
  '🎣', // fishing
];

export function findHabitById(
  habits: Habit[],
  habitId: string
): Habit | undefined {
  return habits.find((h) => h.id === habitId);
}

/**
 * Returns the CSS classes for a date button based on whether the date is in the future.
 * Future dates get disabled styling, past/present dates get hover styling.
 */
export function getDateButtonFutureClasses(isFuture: boolean): string {
  return isFuture ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-700";
}

/**
 * Returns the inline style object for a date completion circle.
 * Completed dates show the habit color, uncompleted dates are transparent.
 */
export function getDateCircleStyle(
  isCompleted: boolean,
  color: string
): { backgroundColor: string } {
  return {
    backgroundColor: isCompleted ? color : "transparent",
  };
}
