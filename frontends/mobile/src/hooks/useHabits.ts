import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { habitsApi } from '@/lib/habits';
import { Habit, HabitFrequency } from '@/types';

const HABITS_QUERY_KEY = ['habits'];

interface CreateHabitData {
  name: string;
  description?: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  target_days?: number[];
}

interface UpdateHabitData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  frequency?: HabitFrequency;
  target_days?: number[];
  is_archived?: boolean;
}

interface CompleteHabitData {
  completed_date: string;
  note?: string;
}

export function useHabits() {
  return useQuery({
    queryKey: HABITS_QUERY_KEY,
    queryFn: habitsApi.getHabits,
  });
}

export function useHabit(id: string) {
  return useQuery({
    queryKey: [...HABITS_QUERY_KEY, id],
    queryFn: () => habitsApi.getHabit(id),
    enabled: !!id,
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHabitData) => habitsApi.createHabit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABITS_QUERY_KEY });
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateHabitData }) =>
      habitsApi.updateHabit(id, data),
    onSuccess: (updatedHabit) => {
      queryClient.invalidateQueries({ queryKey: HABITS_QUERY_KEY });
      queryClient.setQueryData([...HABITS_QUERY_KEY, updatedHabit.id], updatedHabit);
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => habitsApi.deleteHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABITS_QUERY_KEY });
    },
  });
}

export function useCompleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompleteHabitData }) =>
      habitsApi.completeHabit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABITS_QUERY_KEY });
    },
  });
}

export function useUncompleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, completedDate }: { id: string; completedDate: string }) =>
      habitsApi.uncompleteHabit(id, completedDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABITS_QUERY_KEY });
    },
  });
}
