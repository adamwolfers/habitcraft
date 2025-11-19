'use client';

import { useState, useEffect } from 'react';
import { Habit, HabitFormData } from '@/types/habit';
import { fetchHabits, createHabit as apiCreateHabit } from '@/lib/api';

export const useHabits = (userId: string) => {
  const [habits, setHabits] = useState<Habit[]>([]);

  // Fetch habits from API on mount
  useEffect(() => {
    if (!userId) {
      return;
    }

    const loadHabits = async () => {
      try {
        const fetchedHabits = await fetchHabits(userId);
        setHabits(fetchedHabits);
      } catch (error) {
        console.error('Error fetching habits:', error);
      }
    };

    loadHabits();
  }, [userId]);

  const createHabit = async (habitData: HabitFormData): Promise<Habit> => {
    try {
      const newHabit = await apiCreateHabit(userId, habitData);
      setHabits([...habits, newHabit]);
      return newHabit;
    } catch (error) {
      console.error('Error creating habit:', error);
      throw error;
    }
  };

  return {
    habits,
    createHabit,
  };
};
