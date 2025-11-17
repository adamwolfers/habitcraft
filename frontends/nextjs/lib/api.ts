import { Habit } from '@/types/habit';

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
