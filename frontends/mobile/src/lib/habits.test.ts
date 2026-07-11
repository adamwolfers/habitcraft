import { api } from './api';
import { habitsApi } from './habits';
import { Habit, HabitFrequency } from '@/types';

jest.mock('./api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('habitsApi', () => {
  const mockHabit: Habit = {
    id: '1',
    userId: 'user-1',
    name: 'Morning Exercise',
    description: 'Do 30 minutes of exercise',
    icon: '🏃',
    color: '#10b981',
    frequency: 'daily' as HabitFrequency,
    target_days: [1, 2, 3, 4, 5],
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHabits', () => {
    it('makes GET request to /habits via the shared api instance', async () => {
      mockApi.get.mockResolvedValueOnce({ data: [mockHabit] });

      await habitsApi.getHabits();

      expect(mockApi.get).toHaveBeenCalledWith('/habits');
    });

    it('returns list of habits', async () => {
      mockApi.get.mockResolvedValueOnce({ data: [mockHabit] });

      const result = await habitsApi.getHabits();

      expect(result).toEqual([mockHabit]);
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
      mockApi.post.mockResolvedValueOnce({ data: { ...mockHabit, ...newHabitData } });

      await habitsApi.createHabit(newHabitData);

      expect(mockApi.post).toHaveBeenCalledWith('/habits', newHabitData);
    });

    it('returns created habit', async () => {
      const createdHabit = { ...mockHabit, ...newHabitData };
      mockApi.post.mockResolvedValueOnce({ data: createdHabit });

      const result = await habitsApi.createHabit(newHabitData);

      expect(result).toEqual(createdHabit);
    });
  });

  describe('updateHabit', () => {
    const updateData = {
      name: 'Updated Habit Name',
    };

    it('makes PUT request to /habits/:id with data', async () => {
      mockApi.put.mockResolvedValueOnce({ data: { ...mockHabit, ...updateData } });

      await habitsApi.updateHabit('1', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/habits/1', updateData);
    });

    it('returns updated habit', async () => {
      const updatedHabit = { ...mockHabit, ...updateData };
      mockApi.put.mockResolvedValueOnce({ data: updatedHabit });

      const result = await habitsApi.updateHabit('1', updateData);

      expect(result).toEqual(updatedHabit);
    });
  });

  describe('deleteHabit', () => {
    it('makes DELETE request to /habits/:id', async () => {
      mockApi.delete.mockResolvedValueOnce({ data: {} });

      await habitsApi.deleteHabit('1');

      expect(mockApi.delete).toHaveBeenCalledWith('/habits/1');
    });
  });

  describe('completeHabit', () => {
    const completionData = {
      date: '2024-01-15',
      notes: 'Great workout today!',
    };

    it('makes POST request to /habits/:id/completions', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { id: 'completion-1', habit_id: '1', ...completionData },
      });

      await habitsApi.completeHabit('1', completionData);

      expect(mockApi.post).toHaveBeenCalledWith('/habits/1/completions', completionData);
    });

    it('returns completion data', async () => {
      const completion = {
        id: 'completion-1',
        habit_id: '1',
        ...completionData,
        created_at: '2024-01-15T00:00:00Z',
      };
      mockApi.post.mockResolvedValueOnce({ data: completion });

      const result = await habitsApi.completeHabit('1', completionData);

      expect(result).toEqual(completion);
    });
  });

  describe('uncompleteHabit', () => {
    it('makes DELETE request to /habits/:id/completions/:date with no body', async () => {
      mockApi.delete.mockResolvedValueOnce({ data: {} });

      await habitsApi.uncompleteHabit('1', '2024-01-15');

      expect(mockApi.delete).toHaveBeenCalledWith('/habits/1/completions/2024-01-15');
    });
  });
});
