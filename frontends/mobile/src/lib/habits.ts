import axios from 'axios';
import { storage } from './storage';
import { Habit, HabitCompletion, HabitFrequency } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1';

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

async function getAuthHeaders(): Promise<{ Authorization: string }> {
  const tokens = await storage.getTokens();
  if (!tokens) {
    throw new Error('Not authenticated');
  }
  return { Authorization: `Bearer ${tokens.accessToken}` };
}

export const habitsApi = {
  async getHabits(): Promise<Habit[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/habits`, { headers });
    return response.data;
  },

  async getHabit(id: string): Promise<Habit> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/habits/${id}`, { headers });
    return response.data;
  },

  async createHabit(data: CreateHabitData): Promise<Habit> {
    const headers = await getAuthHeaders();
    const response = await axios.post(`${API_BASE_URL}/habits`, data, { headers });
    return response.data;
  },

  async updateHabit(id: string, data: UpdateHabitData): Promise<Habit> {
    const headers = await getAuthHeaders();
    const response = await axios.put(`${API_BASE_URL}/habits/${id}`, data, { headers });
    return response.data;
  },

  async deleteHabit(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    await axios.delete(`${API_BASE_URL}/habits/${id}`, { headers });
  },

  async completeHabit(id: string, data: CompleteHabitData): Promise<HabitCompletion> {
    const headers = await getAuthHeaders();
    const response = await axios.post(`${API_BASE_URL}/habits/${id}/complete`, data, {
      headers,
    });
    return response.data;
  },

  async uncompleteHabit(id: string, completedDate: string): Promise<void> {
    const headers = await getAuthHeaders();
    await axios.delete(`${API_BASE_URL}/habits/${id}/complete`, {
      headers,
      data: { completed_date: completedDate },
    });
  },
};
