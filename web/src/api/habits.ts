/**
 * The signed-in user's habits, as one React Query query that the Habits and
 * Today pages share.
 */
import { useQuery } from '@tanstack/react-query';
import type { Habit } from '../types/api.ts';
import { api } from './client.ts';

export const HABITS = ['habits'] as const;

async function fetchHabits(): Promise<Habit[]> {
  const { data, response } = await api.GET('/api/v1/habits');
  if (!data) throw new Error(`Loading habits failed with ${response.status}`);
  return data;
}

export function useHabits() {
  return useQuery({ queryKey: HABITS, queryFn: fetchHabits });
}
