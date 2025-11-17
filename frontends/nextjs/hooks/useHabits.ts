'use client';

import { useState, useEffect } from 'react';
import { Habit } from '@/types/habit';
import { fetchHabits } from '@/lib/api';

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

  return {
    habits,
  };
};
