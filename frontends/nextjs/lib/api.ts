import { Habit, HabitFormData } from '@/types/habit';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/**
 * Fetch habits for a specific user
 * @param userId - The user ID to fetch habits for
 * @param status - Optional status filter ('active' | 'archived')
 * @returns Promise<Habit[]> - Array of habits
 */
export async function fetchHabits(
  userId: string,
  status?: 'active' | 'archived'
): Promise<Habit[]> {
  const url = new URL(`${API_BASE_URL}/api/v1/habits`);

  if (status) {
    url.searchParams.append('status', status);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch habits: ${response.status}`);
  }

  return response.json();
}

/**
 * Create a new habit for a specific user
 * @param userId - The user ID to create the habit for
 * @param habitData - The habit data to create
 * @returns Promise<Habit> - The created habit
 */
export async function createHabit(
  userId: string,
  habitData: HabitFormData
): Promise<Habit> {
  const response = await fetch(`${API_BASE_URL}/api/v1/habits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    },
    body: JSON.stringify(habitData)
  });

  if (!response.ok) {
    throw new Error(`Failed to create habit: ${response.status}`);
  }

  return response.json();
}
