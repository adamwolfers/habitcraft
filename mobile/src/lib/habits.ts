import { api } from './api';
import { Habit, HabitCompletion, HabitFrequency, HabitWithStats } from '@/types';

interface CreateHabitData {
  name: string;
  description?: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
}

interface UpdateHabitData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  frequency?: HabitFrequency;
  status?: 'active' | 'archived';
}

interface CompleteHabitData {
  date: string;
  notes?: string;
}

export const habitsApi = {
  async getHabits(): Promise<HabitWithStats[]> {
    const response = await api.get('/habits');
    return response.data;
  },

  async createHabit(data: CreateHabitData): Promise<Habit> {
    const response = await api.post('/habits', data);
    return response.data;
  },

  async updateHabit(id: string, data: UpdateHabitData): Promise<Habit> {
    const response = await api.put(`/habits/${id}`, data);
    return response.data;
  },

  async deleteHabit(id: string): Promise<void> {
    await api.delete(`/habits/${id}`);
  },

  async completeHabit(id: string, data: CompleteHabitData): Promise<HabitCompletion> {
    const response = await api.post(`/habits/${id}/completions`, data);
    return response.data;
  },

  async uncompleteHabit(id: string, completedDate: string): Promise<void> {
    await api.delete(`/habits/${id}/completions/${completedDate}`);
  },
};
