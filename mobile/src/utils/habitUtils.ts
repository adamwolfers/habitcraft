import { HabitWithStats } from '@/types';

export function findHabitById(
  habits: HabitWithStats[],
  habitId: string
): HabitWithStats | undefined {
  return habits.find((h) => h.id === habitId);
}
