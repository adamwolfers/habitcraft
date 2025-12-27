const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../db/pool');

// Mock the database pool
jest.mock('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

describe('Completions API', () => {
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
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          date: mockDate,
          notes: 'Completed 30 minutes'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockCompletion);
      expect(pool.query).toHaveBeenCalledTimes(2);
      // Verify SQL formats date as YYYY-MM-DD string (not raw DATE type)
      const insertQuery = pool.query.mock.calls[1][0];
      expect(insertQuery).toContain("TO_CHAR(date, 'YYYY-MM-DD')");
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
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ date: mockDate });

      expect(response.status).toBe(201);
      expect(response.body.notes).toBe(null);
    });

    it('should return 400 if date is missing', async () => {
      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.toLowerCase()).toContain('date');
    });

    it('should return 400 if date format is invalid', async () => {
      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ date: 'invalid-date' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('date');
    });

    it('should return 404 if habit does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('Authorization', `Bearer ${mockToken}`)
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
        .set('Authorization', `Bearer ${mockToken}`)
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
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ date: mockDate });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already completed');
    });

    it('should return 400 if date is in the future', async () => {
      // Create a date that is definitely in the future
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ date: futureDate });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/future/i);
    });

    it('should allow completion for today', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockCompletion = {
        id: mockCompletionId,
        habitId: mockHabitId,
        date: today,
        notes: null,
        createdAt: new Date().toISOString()
      };

      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [mockCompletion]
      });

      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ date: today });

      expect(response.status).toBe(201);
    });

    it('should allow completion for past dates', async () => {
      const pastDate = '2024-01-15';
      const mockCompletion = {
        id: mockCompletionId,
        habitId: mockHabitId,
        date: pastDate,
        notes: null,
        createdAt: new Date().toISOString()
      };

      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [mockCompletion]
      });

      const response = await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ date: pastDate });

      expect(response.status).toBe(201);
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
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCompletions);
      expect(response.body).toHaveLength(2);
      // Verify SQL formats date as YYYY-MM-DD string (not raw DATE type)
      const selectQuery = pool.query.mock.calls[1][0];
      expect(selectQuery).toContain("TO_CHAR(date, 'YYYY-MM-DD')");
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
        .set('Authorization', `Bearer ${mockToken}`);

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
        .set('Authorization', `Bearer ${mockToken}`);

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
        .set('Authorization', `Bearer ${mockToken}`);

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
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 404 if habit does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/v1/habits/${mockHabitId}/completions`)
        .set('Authorization', `Bearer ${mockToken}`);

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
        .set('Authorization', `Bearer ${mockToken}`);

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
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Completion not found');
    });

    it('should return 404 if habit does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 if date format is invalid', async () => {
      const response = await request(app)
        .delete(`/api/v1/habits/${mockHabitId}/completions/invalid-date`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('date');
    });
  });

  describe('PUT /api/v1/habits/:habitId/completions/:date', () => {
    it('should update a completion note', async () => {
      const updatedCompletion = {
        id: mockCompletionId,
        habitId: mockHabitId,
        date: mockDate,
        notes: 'Updated note',
        createdAt: '2025-01-15T10:00:00.000Z'
      };

      // Mock habit exists check
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      // Mock completion update
      pool.query.mockResolvedValueOnce({
        rows: [updatedCompletion]
      });

      const response = await request(app)
        .put(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ notes: 'Updated note' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedCompletion);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE completions'),
        expect.arrayContaining([mockHabitId, mockDate])
      );
    });

    it('should clear note when null is passed', async () => {
      const updatedCompletion = {
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
        rows: [updatedCompletion]
      });

      const response = await request(app)
        .put(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ notes: null });

      expect(response.status).toBe(200);
      expect(response.body.notes).toBe(null);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .send({ notes: 'Updated note' });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .put(`/api/v1/habits/${mockHabitId}/completions/invalid-date`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ notes: 'Updated note' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('date');
    });

    it('should return 404 when completion does not exist', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .put(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ notes: 'Updated note' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Completion not found');
    });

    it('should return 404 when habit does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ notes: 'Updated note' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Habit not found');
    });

    it('should return 403 when habit belongs to different user', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: 'different-user-id' }]
      });

      const response = await request(app)
        .put(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ notes: 'Updated note' });

      expect(response.status).toBe(403);
      expect(response.body.error.toLowerCase()).toContain('access');
    });

    it('should sanitize XSS from notes field', async () => {
      const updatedCompletion = {
        id: mockCompletionId,
        habitId: mockHabitId,
        date: mockDate,
        notes: 'Sanitized notes',
        createdAt: '2025-01-15T10:00:00.000Z'
      };

      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [updatedCompletion]
      });

      await request(app)
        .put(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ notes: '<script>alert("xss")</script>Sanitized notes' });

      const updateCall = pool.query.mock.calls[1];
      const updatedNotes = updateCall[1][0]; // notes is first param
      expect(updatedNotes).toBe('Sanitized notes');
      expect(updatedNotes).not.toContain('<script>');
    });

    it('should trim whitespace from notes field', async () => {
      const updatedCompletion = {
        id: mockCompletionId,
        habitId: mockHabitId,
        date: mockDate,
        notes: 'Trimmed notes',
        createdAt: '2025-01-15T10:00:00.000Z'
      };

      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [updatedCompletion]
      });

      await request(app)
        .put(`/api/v1/habits/${mockHabitId}/completions/${mockDate}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ notes: '  Trimmed notes  ' });

      const updateCall = pool.query.mock.calls[1];
      const updatedNotes = updateCall[1][0];
      expect(updatedNotes).toBe('Trimmed notes');
    });
  });

  describe('Input sanitization', () => {
    it('should sanitize XSS from notes field', async () => {
      const mockCompletion = {
        id: mockCompletionId,
        habitId: mockHabitId,
        date: mockDate,
        notes: 'My notes',
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

      await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          date: mockDate,
          notes: '<script>alert("xss")</script>My notes'
        });

      // Check that the INSERT query was called with sanitized notes
      const insertCall = pool.query.mock.calls[1]; // second call is INSERT
      const insertedNotes = insertCall[1][2]; // third param is notes (habitId, date, notes)
      expect(insertedNotes).toBe('My notes');
      expect(insertedNotes).not.toContain('<script>');
    });

    it('should trim whitespace from notes field', async () => {
      const mockCompletion = {
        id: mockCompletionId,
        habitId: mockHabitId,
        date: mockDate,
        notes: 'Trimmed notes',
        createdAt: '2025-01-15T10:00:00.000Z'
      };

      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockHabitId, user_id: mockUserId }]
      });

      pool.query.mockResolvedValueOnce({
        rows: [mockCompletion]
      });

      await request(app)
        .post(`/api/v1/habits/${mockHabitId}/completions`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          date: mockDate,
          notes: '  Trimmed notes  '
        });

      const insertCall = pool.query.mock.calls[1];
      const insertedNotes = insertCall[1][2];
      expect(insertedNotes).toBe('Trimmed notes');
    });
  });
});
