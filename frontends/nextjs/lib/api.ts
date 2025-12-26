import { Habit, HabitFormData, Completion } from '@/types/habit';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// Track if a refresh is already in progress to avoid multiple concurrent refreshes
let refreshPromise: Promise<boolean> | null = null;

// Callback to handle authentication failures (e.g., redirect to login)
let onAuthFailureCallback: (() => void) | null = null;

/**
 * Configure a callback to be called when authentication fails
 * @param callback - Function to call on auth failure
 */
export function setOnAuthFailure(callback: (() => void) | null): void {
  onAuthFailureCallback = callback;
}

/**
 * Attempt to refresh the access token using the refresh token
 * @returns Promise<boolean> - true if refresh succeeded, false otherwise
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      return true;
    }

    // If refresh fails with 401, redirect to login (refresh token expired/invalid)
    if (response.status === 401) {
      redirectToLogin();
    }

    return false;
  } catch {
    // Network error during refresh - redirect to login
    redirectToLogin();
    return false;
  }
}

/**
 * Handle authentication failure
 * Calls the configured callback or falls back to window.location redirect
 */
function redirectToLogin(): void {
  if (onAuthFailureCallback) {
    onAuthFailureCallback();
  } else if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    // Fallback to direct redirect if no callback configured
    window.location.href = '/login';
  }
}

/**
 * Fetch wrapper that handles 401 responses by attempting token refresh
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param isRetry - Internal flag to prevent infinite retry loops
 * @returns Promise<Response>
 */
async function fetchWithAuth(
  url: string,
  options?: RequestInit,
  isRetry: boolean = false
): Promise<Response> {
  const response = await fetch(url, options);

  // If not a 401, or this is already a retry, or it's the refresh endpoint, just return
  if (
    response.status !== 401 ||
    isRetry ||
    url.includes('/auth/refresh')
  ) {
    return response;
  }

  // Wait for any in-progress refresh, or start a new one
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  const refreshSucceeded = await refreshPromise;

  if (!refreshSucceeded) {
    // Refresh failed, return the original 401 response
    return response;
  }

  // Retry the original request with the new token
  return fetchWithAuth(url, options, true);
}

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

  const response = await fetchWithAuth(url.toString(), {
    credentials: 'include',
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
  const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/habits`, {
    method: 'POST',
    credentials: 'include',
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

  const response = await fetchWithAuth(url.toString(), {
    credentials: 'include',
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

  const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/habits/${habitId}/completions`, {
    method: 'POST',
    credentials: 'include',
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
  const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/habits/${habitId}/completions/${date}`, {
    method: 'DELETE',
    credentials: 'include',
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
export async function updateHabit(
  userId: string,
  habitId: string,
  updates: Partial<Habit>
): Promise<Habit> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/habits/${habitId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    throw new Error(`Failed to update habit: ${response.status}`);
  }

  return response.json();
}

export async function deleteHabit(
  userId: string,
  habitId: string
): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/habits/${habitId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to delete habit: ${response.status}`);
  }
}

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

/**
 * Update the current user's name
 * @param name - The new name
 * @returns Promise<User> - The updated user
 */
export async function updateUserName(name: string): Promise<User> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/users/me`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  });

  if (!response.ok) {
    throw new Error(`Failed to update user: ${response.status}`);
  }

  return response.json();
}

/**
 * Change the current user's password
 * @param currentPassword - The current password for verification
 * @param newPassword - The new password
 * @param confirmPassword - Confirmation of the new password
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/users/me/password`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
  });

  if (!response.ok) {
    const data = await response.json();
    if (response.status === 401 || response.status === 400) {
      throw new Error(data.error || 'Password change failed');
    }
    throw new Error('Failed to change password');
  }
}
