import { fetchHabits, createHabit, fetchCompletions, createCompletion, deleteCompletion, deleteHabit } from './api';
import { Habit, Completion } from '@/types/habit';

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
        credentials: 'include',
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
        credentials: 'include',
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

describe('fetchCompletions', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockHabitId = 'habit-123';
  const API_BASE_URL = 'http://localhost:3000';

  beforeAll(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  const mockCompletions: Completion[] = [
    {
      id: 'completion-1',
      habitId: mockHabitId,
      date: '2025-01-15',
      notes: 'Great session',
      createdAt: '2025-01-15T10:00:00.000Z'
    },
    {
      id: 'completion-2',
      habitId: mockHabitId,
      date: '2025-01-14',
      notes: null,
      createdAt: '2025-01-14T10:00:00.000Z'
    }
  ];

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch completions successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockCompletions
    });

    const result = await fetchCompletions(mockUserId, mockHabitId);

    expect(result).toEqual(mockCompletions);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/habits/${mockHabitId}/completions`,
      {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': mockUserId
        }
      }
    );
  });

  it('should fetch completions with date range', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [mockCompletions[0]]
    });

    const result = await fetchCompletions(mockUserId, mockHabitId, '2025-01-10', '2025-01-15');

    expect(result).toEqual([mockCompletions[0]]);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/habits/${mockHabitId}/completions?startDate=2025-01-10&endDate=2025-01-15`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-User-Id': mockUserId
        })
      })
    );
  });

  it('should return empty array when no completions exist', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => []
    });

    const result = await fetchCompletions(mockUserId, mockHabitId);

    expect(result).toEqual([]);
  });

  it('should throw error when API returns error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404
    });

    await expect(fetchCompletions(mockUserId, mockHabitId)).rejects.toThrow('Failed to fetch completions: 404');
  });
});

describe('createCompletion', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockHabitId = 'habit-123';
  const API_BASE_URL = 'http://localhost:3000';

  beforeAll(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a completion successfully', async () => {
    const mockCompletion: Completion = {
      id: 'completion-1',
      habitId: mockHabitId,
      date: '2025-01-15',
      notes: 'Completed 30 minutes',
      createdAt: '2025-01-15T10:00:00.000Z'
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockCompletion
    });

    const result = await createCompletion(mockUserId, mockHabitId, '2025-01-15', 'Completed 30 minutes');

    expect(result).toEqual(mockCompletion);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/habits/${mockHabitId}/completions`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': mockUserId
        },
        body: JSON.stringify({
          date: '2025-01-15',
          notes: 'Completed 30 minutes'
        })
      }
    );
  });

  it('should create a completion without notes', async () => {
    const mockCompletion: Completion = {
      id: 'completion-1',
      habitId: mockHabitId,
      date: '2025-01-15',
      notes: null,
      createdAt: '2025-01-15T10:00:00.000Z'
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockCompletion
    });

    const result = await createCompletion(mockUserId, mockHabitId, '2025-01-15');

    expect(result).toEqual(mockCompletion);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/habits/${mockHabitId}/completions`,
      expect.objectContaining({
        body: JSON.stringify({ date: '2025-01-15' })
      })
    );
  });

  it('should throw error when creation fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409
    });

    await expect(createCompletion(mockUserId, mockHabitId, '2025-01-15')).rejects.toThrow('Failed to create completion: 409');
  });
});

describe('deleteCompletion', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockHabitId = 'habit-123';
  const API_BASE_URL = 'http://localhost:3000';

  beforeAll(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should delete a completion successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 204
    });

    await deleteCompletion(mockUserId, mockHabitId, '2025-01-15');

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/habits/${mockHabitId}/completions/2025-01-15`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': mockUserId
        }
      }
    );
  });

  it('should throw error when deletion fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404
    });

    await expect(deleteCompletion(mockUserId, mockHabitId, '2025-01-15')).rejects.toThrow('Failed to delete completion: 404');
  });
});

describe('deleteHabit', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockHabitId = 'habit-123';
  const API_BASE_URL = 'http://localhost:3000';

  beforeAll(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should delete a habit successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 204
    });

    await deleteHabit(mockUserId, mockHabitId);

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/habits/${mockHabitId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': mockUserId
        }
      }
    );
  });

  it('should throw error when deletion fails due to not found', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404
    });

    await expect(deleteHabit(mockUserId, mockHabitId)).rejects.toThrow('Failed to delete habit: 404');
  });

  it('should throw error when deletion fails due to invalid habit ID', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400
    });

    await expect(deleteHabit(mockUserId, 'invalid-id')).rejects.toThrow('Failed to delete habit: 400');
  });

  it('should throw error when deletion fails due to unauthorized', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401
    });

    await expect(deleteHabit(mockUserId, mockHabitId)).rejects.toThrow('Failed to delete habit: 401');
  });
});

describe('API Client - JWT Integration', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const API_BASE_URL = 'http://localhost:3000';

  beforeAll(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('401 Response Interception', () => {
    it('should intercept 401 response and attempt token refresh', async () => {
      const mockRefreshResponse = { ok: true, status: 200, json: async () => ({}) };
      const mockSuccessResponse = { ok: true, status: 200, json: async () => [] };

      let callCount = 0;
      global.fetch = jest.fn((url) => {
        callCount++;
        if (callCount === 1) {
          // First call returns 401
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
          } as Response);
        } else if (url.toString().includes('/auth/refresh')) {
          // Refresh token call
          return Promise.resolve(mockRefreshResponse as Response);
        } else {
          // Retry call succeeds
          return Promise.resolve(mockSuccessResponse as Response);
        }
      }) as jest.Mock;

      const result = await fetchHabits(mockUserId);

      // Should have called fetch 3 times: original request, refresh, retry
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual([]);
    });

    it('should not intercept non-401 responses', async () => {
      const mockResponse = { ok: false, status: 404, json: async () => ({}) };
      global.fetch = jest.fn(() => Promise.resolve(mockResponse as Response)) as jest.Mock;

      await expect(fetchHabits(mockUserId)).rejects.toThrow('Failed to fetch habits: 404');

      // Should only call once (no retry on 404)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

  });

  describe('Token Refresh on 401', () => {
    it('should call refresh endpoint when receiving 401', async () => {
      const mockRefreshResponse = { ok: true, status: 200, json: async () => ({}) };
      const mockSuccessResponse = { ok: true, status: 200, json: async () => [] };

      let callCount = 0;
      global.fetch = jest.fn((url) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
          } as Response);
        } else if (url.toString().includes('/auth/refresh')) {
          return Promise.resolve(mockRefreshResponse as Response);
        } else {
          return Promise.resolve(mockSuccessResponse as Response);
        }
      }) as jest.Mock;

      await fetchHabits(mockUserId);

      // Find the refresh call
      const refreshCall = (global.fetch as jest.Mock).mock.calls.find(
        (call: any[]) => call[0].includes('/auth/refresh')
      );

      expect(refreshCall).toBeDefined();
      expect(refreshCall[0]).toContain('/api/v1/auth/refresh');
    });

    it('should use correct method and credentials for refresh', async () => {
      const mockRefreshResponse = { ok: true, status: 200, json: async () => ({}) };
      const mockSuccessResponse = { ok: true, status: 200, json: async () => [] };

      let callCount = 0;
      global.fetch = jest.fn((url, options) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
          } as Response);
        } else if (url.toString().includes('/auth/refresh')) {
          // Verify refresh request options
          expect(options?.method).toBe('POST');
          expect((options as RequestInit)?.credentials).toBe('include');
          return Promise.resolve(mockRefreshResponse as Response);
        } else {
          return Promise.resolve(mockSuccessResponse as Response);
        }
      }) as jest.Mock;

      await fetchHabits(mockUserId);
    });
  });

  describe('Request Retry with New Token', () => {
    it('should retry original request after successful token refresh', async () => {
      const mockRefreshResponse = { ok: true, status: 200, json: async () => ({}) };
      const mockSuccessResponse = { ok: true, status: 200, json: async () => [{ id: 1, name: 'Test Habit' }] };

      let callCount = 0;
      global.fetch = jest.fn((url, options) => {
        callCount++;
        if (callCount === 1) {
          // First attempt fails with 401
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
          } as Response);
        } else if (url.toString().includes('/auth/refresh')) {
          // Refresh succeeds
          return Promise.resolve(mockRefreshResponse as Response);
        } else if (callCount === 3) {
          // Retry with new token succeeds
          return Promise.resolve(mockSuccessResponse as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({}),
        } as Response);
      }) as jest.Mock;

      const result = await fetchHabits(mockUserId);

      expect(result).toEqual([{ id: 1, name: 'Test Habit' }]);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should preserve original request method and body on retry', async () => {
      const habitData = { name: 'New Habit', frequency: 'daily' as const };
      const mockRefreshResponse = { ok: true, status: 200, json: async () => ({}) };
      const mockSuccessResponse = { ok: true, status: 201, json: async () => ({ id: 1, ...habitData }) };

      let callCount = 0;
      let retryOptions: RequestInit | undefined;

      global.fetch = jest.fn((url, options) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
          } as Response);
        } else if (url.toString().includes('/auth/refresh')) {
          return Promise.resolve(mockRefreshResponse as Response);
        } else if (callCount === 3) {
          retryOptions = options as RequestInit;
          return Promise.resolve(mockSuccessResponse as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({}),
        } as Response);
      }) as jest.Mock;

      await createHabit(mockUserId, habitData);

      expect(retryOptions?.method).toBe('POST');
      expect(retryOptions?.body).toBe(JSON.stringify(habitData));
    });

    it('should only retry once per request', async () => {
      const mockRefreshResponse = { ok: true, status: 200, json: async () => ({}) };

      let callCount = 0;
      global.fetch = jest.fn((url) => {
        callCount++;
        if (url.toString().includes('/auth/refresh')) {
          return Promise.resolve(mockRefreshResponse as Response);
        }
        // Always return 401
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        } as Response);
      }) as jest.Mock;

      await expect(fetchHabits(mockUserId)).rejects.toThrow();

      // Should be: original call (401), refresh, retry (401), but not another retry
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Auth Failure Callback', () => {
    it('should call onAuthFailure callback when refresh returns 401', async () => {
      const onAuthFailure = jest.fn();

      // Import and configure the callback
      const { setOnAuthFailure } = require('./api');
      setOnAuthFailure(onAuthFailure);

      const mock401Response = { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
      global.fetch = jest.fn(() => Promise.resolve(mock401Response as Response)) as jest.Mock;

      await expect(fetchHabits(mockUserId)).rejects.toThrow();

      expect(onAuthFailure).toHaveBeenCalled();
    });
  });

});
