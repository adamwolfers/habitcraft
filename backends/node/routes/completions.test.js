const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

// Mock the database pool
jest.mock('../db/pool');

describe('Completions API', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockHabitId = 'habit-123';
  const mockCompletionId = 'completion-123';
  const mockDate = '2025-01-15';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/habits/:habitId/completions', () => {
    it('should create a new completion', async () => {
      const mockCompletion = {
        id: mockCompletionId,
        habitId: mockHabitId,
        date: mockDate,
        notes: 'Completed 30 minutes',
        createdAt: '2025-01-15T10:00:00.000Z'
      };

      // Mock habit exists check
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      // Mock completion insert
      pool.query.mockResolvedValueOnce({
        rows: [mockCompletion]
      });

      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('X-User-Id', mockUserId)
        .send({
          date: mockDate,
          notes: 'Completed 30 minutes'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockCompletion);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should create a completion without notes', async () => {
      const mockCompletion = {
        id: mockCompletionId,
        habitId: mockHabitId,
        date: mockDate,
        notes: null,
        createdAt: '2025-01-15T10:00:00.000Z'
      };

      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [mockCompletion]
      });

      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('X-User-Id', mockUserId)
        .send({ date: mockDate });

      expect(response.status).toBe(201);
      expect(response.body.notes).toBe(null);
    });

    it('should return 400 if date is missing', async () => {
      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('X-User-Id', mockUserId)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.toLowerCase()).toContain('date');
    });

    it('should return 400 if date format is invalid', async () => {
      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('X-User-Id', mockUserId)
        .send({ date: 'invalid-date' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('date');
    });

    it('should return 404 if habit does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('X-User-Id', mockUserId)
        .send({ date: mockDate });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Habit not found');
    });

    it('should return 403 if habit belongs to different user', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: 'different-user-id' }]
      });

      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('X-User-Id', mockUserId)
        .send({ date: mockDate });

      expect(response.status).toBe(403);
      expect(response.body.error.toLowerCase()).toContain('access');
    });

    it('should return 409 if completion already exists for that date', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      // Mock duplicate key error
      const duplicateError = new Error('duplicate key value');
      duplicateError.code = '23505';
      pool.query.mockRejectedValueOnce(duplicateError);

      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('X-User-Id', mockUserId)
        .send({ date: mockDate });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already completed');
    });
  });

  describe('GET /api/v1/habits/:habitId/completions', () => {
    it('should return all completions for a habit', async () => {
      const mockCompletions = [
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

      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: mockCompletions
      });

      const response = await request(app)
        .get(`/api/v1/habits/${mockHabitId}/completions`)
        .set('X-User-Id', mockUserId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCompletions);
      expect(response.body).toHaveLength(2);
    });

    it('should filter completions by start date', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [{ id: 'completion-1', date: '2025-01-15' }]
      });

      const response = await request(app)
        .get(`/api/v1/habits/${mockHabitId}/completions?startDate=2025-01-15`)
        .set('X-User-Id', mockUserId);

      expect(response.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('date >= $2'),
        expect.arrayContaining([mockHabitId, '2025-01-15'])
      );
    });

    it('should filter completions by end date', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [{ id: 'completion-1', date: '2025-01-15' }]
      });

      const response = await request(app)
        .get(`/api/v1/habits/${mockHabitId}/completions?endDate=2025-01-20`)
        .set('X-User-Id', mockUserId);

      expect(response.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('date <= $2'),
        expect.arrayContaining([mockHabitId, '2025-01-20'])
      );
    });

    it('should filter completions by date range', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get(`/api/v1/habits/${mockHabitId}/completions?startDate=2025-01-10&endDate=2025-01-20`)
        .set('X-User-Id', mockUserId);

      expect(response.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('date >= $2 AND date <= $3'),
        expect.arrayContaining([mockHabitId, '2025-01-10', '2025-01-20'])
      );
    });

    it('should return empty array if no completions exist', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get(`/api/v1/habits/${mockHabitId}/completions`)
        .set('X-User-Id', mockUserId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 404 if habit does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/v1/habits/${mockHabitId}/completions`)
        .set('X-User-Id', mockUserId);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/habits/:habitId/completions/:date', () => {
    it('should delete a completion', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockCompletionId }]
      });

      const response = await request(app)
        .delete(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('X-User-Id', mockUserId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Completion deleted successfully',
        habitId: mockHabitId,
        date: mockDate
      });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM completions'),
        expect.arrayContaining([mockHabitId, mockDate])
      );
    });

    it('should return 404 if completion does not exist', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .delete(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('X-User-Id', mockUserId);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Completion not found');
    });

    it('should return 404 if habit does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('X-User-Id', mockUserId);

      expect(response.status).toBe(404);
    });

    it('should return 400 if date format is invalid', async () => {
      const response = await request(app)
        .delete(`/api/v1/habits/${mockHabitId}/completions/invalid-date`)
        .set('X-User-Id', mockUserId);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('date');
    });
  });
});
