import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import Toast from 'react-native-toast-message';
import { habitsApi } from '@/lib/habits';
import { mutationQueue, networkStatus } from '@/lib/offline';
import { findHabitById } from '@/utils/habitUtils';
import { Habit, HabitWithStats } from '@/types';

const HABITS_QUERY_KEY = ['habits'];

export interface CreateHabitData {
  name: string;
  description?: string;
  icon: string;
  color: string;
}

export interface UpdateHabitData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  status?: 'active' | 'archived';
}

export interface CompleteHabitData {
  date: string;
  notes?: string;
}

export function useHabits() {
  return useQuery({
    queryKey: HABITS_QUERY_KEY,
    queryFn: habitsApi.getHabits,
  });
}

export function useHabit(id: string) {
  const habitsQuery = useHabits();
  const habit = habitsQuery.data ? findHabitById(habitsQuery.data, id) : undefined;

  return {
    data: habit,
    isLoading: habitsQuery.isLoading,
    isError: habitsQuery.isError || (!habitsQuery.isLoading && !!id && !habit),
    error: habitsQuery.error,
    refetch: habitsQuery.refetch,
  };
}

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHabitData) => {
      const isOnline = await networkStatus.isOnline();

      if (!isOnline) {
        // Generate temp ID and queue mutation
        const tempId = `temp-${uuidv4()}`;
        await mutationQueue.add('createHabit', data, tempId);

        // Return optimistic habit
        const optimisticHabit: Habit = {
          id: tempId,
          userId: 'pending',
          name: data.name,
          // The server stores an absent description as SQL NULL, so the
          // optimistic habit must too -- otherwise the card re-renders with a
          // different value the moment the queued mutation syncs.
          description: data.description ?? null,
          icon: data.icon,
          color: data.color,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return optimisticHabit;
      }

      return habitsApi.createHabit(data);
    },
    onMutate: async (_newHabit) => {
      await queryClient.cancelQueries({ queryKey: HABITS_QUERY_KEY });

      const previousHabits = queryClient.getQueryData<HabitWithStats[]>(HABITS_QUERY_KEY);

      // Optimistic update happens via mutationFn return value
      return { previousHabits };
    },
    onSuccess: (newHabit) => {
      const habitWithStats: HabitWithStats = {
        ...newHabit,
        completions: (newHabit as Partial<HabitWithStats>).completions ?? [],
      };
      queryClient.setQueryData<HabitWithStats[]>(HABITS_QUERY_KEY, (old) => {
        if (!old) return [habitWithStats];
        return [...old, habitWithStats];
      });
      Toast.show({
        type: 'success',
        text1: 'Habit created',
        text2: newHabit.name,
        visibilityTime: 2000,
      });
    },
    onError: (_err, _newHabit, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(HABITS_QUERY_KEY, context.previousHabits);
      }
      Toast.show({
        type: 'error',
        text1: 'Failed to create habit',
        text2: 'Please try again',
        visibilityTime: 3000,
      });
    },
    onSettled: async () => {
      const isOnline = await networkStatus.isOnline();
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: HABITS_QUERY_KEY });
      }
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateHabitData }) => {
      const isOnline = await networkStatus.isOnline();

      if (!isOnline) {
        await mutationQueue.add('updateHabit', { id, data });
        // Return optimistic result
        const currentHabits = queryClient.getQueryData<HabitWithStats[]>(HABITS_QUERY_KEY);
        const existingHabit = currentHabits?.find((h) => h.id === id);
        if (existingHabit) {
          return { ...existingHabit, ...data, updated_at: new Date().toISOString() };
        }
        throw new Error('Habit not found in cache');
      }

      return habitsApi.updateHabit(id, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: HABITS_QUERY_KEY });

      const previousHabits = queryClient.getQueryData<HabitWithStats[]>(HABITS_QUERY_KEY);

      // Optimistic update
      queryClient.setQueryData<HabitWithStats[]>(HABITS_QUERY_KEY, (old) => {
        if (!old) return old;
        return old.map((habit) =>
          habit.id === id ? { ...habit, ...data, updated_at: new Date().toISOString() } : habit
        );
      });

      return { previousHabits };
    },
    onSuccess: (updatedHabit) => {
      queryClient.setQueryData([...HABITS_QUERY_KEY, updatedHabit.id], updatedHabit);
      Toast.show({
        type: 'success',
        text1: 'Habit updated',
        visibilityTime: 2000,
      });
    },
    onError: (_err, _variables, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(HABITS_QUERY_KEY, context.previousHabits);
      }
      Toast.show({
        type: 'error',
        text1: 'Failed to update habit',
        text2: 'Please try again',
        visibilityTime: 3000,
      });
    },
    onSettled: async () => {
      const isOnline = await networkStatus.isOnline();
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: HABITS_QUERY_KEY });
      }
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const isOnline = await networkStatus.isOnline();

      if (!isOnline) {
        await mutationQueue.add('deleteHabit', { id });
        return;
      }

      return habitsApi.deleteHabit(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: HABITS_QUERY_KEY });

      const previousHabits = queryClient.getQueryData<HabitWithStats[]>(HABITS_QUERY_KEY);

      // Optimistic update - remove habit
      queryClient.setQueryData<HabitWithStats[]>(HABITS_QUERY_KEY, (old) => {
        if (!old) return old;
        return old.filter((habit) => habit.id !== id);
      });

      return { previousHabits };
    },
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: 'Habit deleted',
        visibilityTime: 2000,
      });
    },
    onError: (_err, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(HABITS_QUERY_KEY, context.previousHabits);
      }
      Toast.show({
        type: 'error',
        text1: 'Failed to delete habit',
        text2: 'Please try again',
        visibilityTime: 3000,
      });
    },
    onSettled: async () => {
      const isOnline = await networkStatus.isOnline();
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: HABITS_QUERY_KEY });
      }
    },
  });
}

export function useCompleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompleteHabitData }) => {
      const isOnline = await networkStatus.isOnline();

      if (!isOnline) {
        await mutationQueue.add('completeHabit', { id, data });
        // Return optimistic completion
        return {
          id: `temp-completion-${uuidv4()}`,
          habitId: id,
          date: data.date,
          notes: data.notes ?? null,
          createdAt: new Date().toISOString(),
        };
      }

      return habitsApi.completeHabit(id, data);
    },
    onSettled: async () => {
      const isOnline = await networkStatus.isOnline();
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: HABITS_QUERY_KEY });
      }
    },
  });
}

export function useUncompleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, completedDate }: { id: string; completedDate: string }) => {
      const isOnline = await networkStatus.isOnline();

      if (!isOnline) {
        await mutationQueue.add('uncompleteHabit', { id, completedDate });
        return;
      }

      return habitsApi.uncompleteHabit(id, completedDate);
    },
    onSettled: async () => {
      const isOnline = await networkStatus.isOnline();
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: HABITS_QUERY_KEY });
      }
    },
  });
}
