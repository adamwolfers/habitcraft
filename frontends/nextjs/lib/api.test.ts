import { fetchHabits } from './api';
import { Habit } from '@/types/habit';

describe('fetchHabits', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const API_BASE_URL = 'http://localhost:3000';

  // Set up environment variable for tests
  beforeAll(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  const mockHabits: Habit[] = [
    {
      id: 'habit-1',
      userId: mockUserId,
      name: 'Morning Exercise',
      description: null,
      frequency: 'daily',
      targetDays: [],
      color: '#3B82F6',
      icon: '⭐',
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'habit-2',
      userId: mockUserId,
      name: 'Read Books',
      description: 'Read for 30 minutes',
      frequency: 'weekly',
      targetDays: [1, 3, 5],
      color: '#FF5733',
      icon: '📚',
      status: 'active',
      createdAt: '2025-01-02T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z'
    }
  ];

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch habits successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHabits
    });

    const result = await fetchHabits(mockUserId);

    expect(result).toEqual(mockHabits);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/habits`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': mockUserId
        }
      }
    );
  });

  it('should fetch habits with status filter', async () => {
    const activeHabits = mockHabits.filter(h => h.status === 'active');

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => activeHabits
    });

    const result = await fetchHabits(mockUserId, 'active');

    expect(result).toEqual(activeHabits);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/habits?status=active`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': mockUserId
        }
      }
    );
  });

  it('should return empty array when no habits exist', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => []
    });

    const result = await fetchHabits(mockUserId);

    expect(result).toEqual([]);
  });

  it('should throw error when API returns 401 unauthorized', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized', message: 'User ID not provided' })
    });

    await expect(fetchHabits(mockUserId)).rejects.toThrow('Failed to fetch habits: 401');
  });

  it('should throw error when API returns 500 server error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' })
    });

    await expect(fetchHabits(mockUserId)).rejects.toThrow('Failed to fetch habits: 500');
  });

  it('should throw error when network request fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(fetchHabits(mockUserId)).rejects.toThrow('Network error');
  });

  it('should handle malformed JSON response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Invalid JSON');
      }
    });

    await expect(fetchHabits(mockUserId)).rejects.toThrow('Invalid JSON');
  });
});
