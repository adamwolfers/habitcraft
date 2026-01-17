import axios from 'axios';
import { habitsApi } from './habits';
import { storage } from './storage';
import { Habit, HabitFrequency } from '@/types';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Mock storage
jest.mock('./storage', () => ({
  storage: {
    getTokens: jest.fn(),
  },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('habitsApi', () => {
  const mockTokens = { accessToken: 'test-token', refreshToken: 'refresh' };

  const mockHabit: Habit = {
    id: '1',
    user_id: 'user-1',
    name: 'Morning Exercise',
    description: 'Do 30 minutes of exercise',
    icon: '🏃',
    color: '#10b981',
    frequency: 'daily' as HabitFrequency,
    target_days: [1, 2, 3, 4, 5],
    is_archived: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getTokens.mockResolvedValue(mockTokens);
  });

  describe('getHabits', () => {
    it('makes GET request to /habits with auth header', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: [mockHabit] });

      await habitsApi.getHabits();

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/habits'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });

    it('returns list of habits', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: [mockHabit] });

      const result = await habitsApi.getHabits();

      expect(result).toEqual([mockHabit]);
    });

    it('throws error when not authenticated', async () => {
      mockStorage.getTokens.mockResolvedValueOnce(null);

      await expect(habitsApi.getHabits()).rejects.toThrow('Not authenticated');
    });
  });

  describe('getHabit', () => {
    it('makes GET request to /habits/:id with auth header', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: mockHabit });

      await habitsApi.getHabit('1');

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/habits/1'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });

    it('returns habit data', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: mockHabit });

      const result = await habitsApi.getHabit('1');

      expect(result).toEqual(mockHabit);
    });
  });

  describe('createHabit', () => {
    const newHabitData = {
      name: 'Read Books',
      description: 'Read for 30 minutes',
      icon: '📚',
      color: '#6366f1',
      frequency: 'daily' as HabitFrequency,
    };

    it('makes POST request to /habits with data', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { ...mockHabit, ...newHabitData } });

      await habitsApi.createHabit(newHabitData);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/habits'),
        newHabitData,
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });

    it('returns created habit', async () => {
      const createdHabit = { ...mockHabit, ...newHabitData };
      mockAxios.post.mockResolvedValueOnce({ data: createdHabit });

      const result = await habitsApi.createHabit(newHabitData);

      expect(result).toEqual(createdHabit);
    });
  });

  describe('updateHabit', () => {
    const updateData = {
      name: 'Updated Habit Name',
    };

    it('makes PUT request to /habits/:id with data', async () => {
      mockAxios.put.mockResolvedValueOnce({ data: { ...mockHabit, ...updateData } });

      await habitsApi.updateHabit('1', updateData);

      expect(mockAxios.put).toHaveBeenCalledWith(
        expect.stringContaining('/habits/1'),
        updateData,
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });

    it('returns updated habit', async () => {
      const updatedHabit = { ...mockHabit, ...updateData };
      mockAxios.put.mockResolvedValueOnce({ data: updatedHabit });

      const result = await habitsApi.updateHabit('1', updateData);

      expect(result).toEqual(updatedHabit);
    });
  });

  describe('deleteHabit', () => {
    it('makes DELETE request to /habits/:id', async () => {
      mockAxios.delete.mockResolvedValueOnce({ data: {} });

      await habitsApi.deleteHabit('1');

      expect(mockAxios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/habits/1'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  describe('completeHabit', () => {
    const completionData = {
      completed_date: '2024-01-15',
      note: 'Great workout today!',
    };

    it('makes POST request to /habits/:id/complete', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'completion-1', habit_id: '1', ...completionData },
      });

      await habitsApi.completeHabit('1', completionData);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/habits/1/complete'),
        completionData,
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });

    it('returns completion data', async () => {
      const completion = {
        id: 'completion-1',
        habit_id: '1',
        ...completionData,
        created_at: '2024-01-15T00:00:00Z',
      };
      mockAxios.post.mockResolvedValueOnce({ data: completion });

      const result = await habitsApi.completeHabit('1', completionData);

      expect(result).toEqual(completion);
    });
  });

  describe('uncompleteHabit', () => {
    it('makes DELETE request to /habits/:id/complete with date', async () => {
      mockAxios.delete.mockResolvedValueOnce({ data: {} });

      await habitsApi.uncompleteHabit('1', '2024-01-15');

      expect(mockAxios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/habits/1/complete'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
          data: { completed_date: '2024-01-15' },
        })
      );
    });
  });
});
