import { Habit, HabitFormData, Completion } from '@/types/habit';

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

/**
 * Fetch completions for a specific habit
 * @param userId - The user ID
 * @param habitId - The habit ID to fetch completions for
 * @param startDate - Optional start date filter (YYYY-MM-DD)
 * @param endDate - Optional end date filter (YYYY-MM-DD)
 * @returns Promise<Completion[]> - Array of completions
 */
export async function fetchCompletions(
  userId: string,
  habitId: string,
  startDate?: string,
  endDate?: string
): Promise<Completion[]> {
  const url = new URL(`${API_BASE_URL}/api/v1/habits/${habitId}/completions`);

  if (startDate) {
    url.searchParams.append('startDate', startDate);
  }
  if (endDate) {
    url.searchParams.append('endDate', endDate);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch completions: ${response.status}`);
  }

  return response.json();
}

/**
 * Create a completion for a habit
 * @param userId - The user ID
 * @param habitId - The habit ID
 * @param date - The completion date (YYYY-MM-DD)
 * @param notes - Optional notes
 * @returns Promise<Completion> - The created completion
 */
export async function createCompletion(
  userId: string,
  habitId: string,
  date: string,
  notes?: string
): Promise<Completion> {
  const body: { date: string; notes?: string } = { date };
  if (notes) {
    body.notes = notes;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/habits/${habitId}/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Failed to create completion: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a completion for a habit
 * @param userId - The user ID
 * @param habitId - The habit ID
 * @param date - The completion date (YYYY-MM-DD)
 */
export async function deleteCompletion(
  userId: string,
  habitId: string,
  date: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/habits/${habitId}/completions/${date}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to delete completion: ${response.status}`);
  }
}

/**
 * Delete a habit
 * @param userId - The user ID
 * @param habitId - The habit ID to delete
 */
export async function deleteHabit(
  userId: string,
  habitId: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/habits/${habitId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to delete habit: ${response.status}`);
  }
}
