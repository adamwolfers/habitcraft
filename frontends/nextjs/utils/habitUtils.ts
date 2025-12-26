import { Habit } from "@/types/habit";

export const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
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
];

export function findHabitById(
  habits: Habit[],
  habitId: string
): Habit | undefined {
  return habits.find((h) => h.id === habitId);
}
