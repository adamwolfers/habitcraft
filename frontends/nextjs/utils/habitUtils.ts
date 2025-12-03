import { Habit } from "@/types/habit";

export function findHabitById(
  habits: Habit[],
  habitId: string
): Habit | undefined {
  return habits.find((h) => h.id === habitId);
}
