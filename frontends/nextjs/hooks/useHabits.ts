'use client';

import { useState, useEffect } from 'react';
import { Habit, HabitFormData, Completion } from '@/types/habit';
import {
  fetchHabits,
  createHabit as apiCreateHabit,
  updateHabit as apiUpdateHabit,
  fetchCompletions as apiFetchCompletions,
  createCompletion as apiCreateCompletion,
  deleteCompletion as apiDeleteCompletion,
  deleteHabit as apiDeleteHabit
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { filterCompletionsByDate } from '@/utils/completionUtils';

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export const useHabits = (userId: string) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Map<string, Completion[]>>(new Map());
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Fetch habits and their completions from API on mount
  useEffect(() => {
    // Don't fetch if no userId, still loading auth, or not authenticated
    if (!userId || isAuthLoading || !isAuthenticated) {
      return;
    }

    const loadHabitsAndCompletions = async () => {
      try {
        const fetchedHabits = await fetchHabits(userId);
        setHabits(fetchedHabits);

        // Fetch completions for each habit
        const completionsMap = new Map<string, Completion[]>();
        await Promise.all(
          fetchedHabits.map(async (habit) => {
            try {
              const habitCompletions = await apiFetchCompletions(userId, habit.id);
              completionsMap.set(habit.id, habitCompletions);
            } catch (error) {
              console.error(`Error fetching completions for habit ${habit.id}:`, error);
              completionsMap.set(habit.id, []);
            }
          })
        );
        setCompletions(completionsMap);
      } catch (error) {
        console.error('Error fetching habits:', error);
      }
    };

    loadHabitsAndCompletions();
  }, [userId, isAuthLoading, isAuthenticated]);

  const createHabit = async (habitData: HabitFormData): Promise<Habit> => {
    try {
      const newHabit = await apiCreateHabit(userId, habitData);
      setHabits([...habits, newHabit]);
      // Initialize empty completions for new habit
      setCompletions(new Map(completions).set(newHabit.id, []));
      return newHabit;
    } catch (error) {
      console.error('Error creating habit:', error);
      throw error;
    }
  };

  const isHabitCompletedOnDate = (habitId: string, date: Date): boolean => {
    const habitCompletions = completions.get(habitId) || [];
    const dateString = formatDate(date);
    return habitCompletions.some(completion => {
      // Strip timestamp from completion.date if it exists
      const completionDate = completion.date.split('T')[0];
      return completionDate === dateString;
    });
  };

  const toggleCompletion = async (habitId: string, date: Date): Promise<void> => {
    const dateString = formatDate(date);
    const isCompleted = isHabitCompletedOnDate(habitId, date);

    try {
      if (isCompleted) {
        // Delete completion
        await apiDeleteCompletion(userId, habitId, dateString);

        // Update local state
        const habitCompletions = completions.get(habitId) || [];
        const updatedCompletions = filterCompletionsByDate(habitCompletions, dateString, 'exclude');
        setCompletions(new Map(completions).set(habitId, updatedCompletions));
      } else {
        // Create completion
        const newCompletion = await apiCreateCompletion(userId, habitId, dateString);

        // Update local state
        const habitCompletions = completions.get(habitId) || [];
        setCompletions(new Map(completions).set(habitId, [...habitCompletions, newCompletion]));
      }
    } catch (error) {
      console.error('Error toggling completion:', error);
    }
  };

  const updateHabit = async (habitId: string, updates: Partial<Habit>): Promise<Habit> => {
    try {
      const updatedHabit = await apiUpdateHabit(userId, habitId, updates);

      // Update habit in local state
      setHabits(habits.map(h => h.id === habitId ? updatedHabit : h));

      return updatedHabit;
    } catch (error) {
      console.error('Error updating habit:', error);
      throw error;
    }
  };

  const deleteHabit = async (habitId: string): Promise<void> => {
    try {
      await apiDeleteHabit(userId, habitId);

      // Remove habit from local state
      setHabits(habits.filter(h => h.id !== habitId));

      // Remove habit's completions from local state
      const newCompletions = new Map(completions);
      newCompletions.delete(habitId);
      setCompletions(newCompletions);
    } catch (error) {
      console.error('Error deleting habit:', error);
      throw error;
    }
  };

  return {
    habits,
    createHabit,
    updateHabit,
    toggleCompletion,
    isHabitCompletedOnDate,
    deleteHabit,
    isAuthLoading,
  };
};
