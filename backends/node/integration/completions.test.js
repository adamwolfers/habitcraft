/**
 * Completion Tracking Integration Tests
 *
 * Tests completion operations against the real test database.
 *
 * Test fixtures (from setup.js):
 * - User 1: test@example.com - has 3 habits (exercise, reading, archived)
 * - User 2: test2@example.com - has 1 habit (user2Habit)
 */

const request = require('supertest');
const app = require('../app');
const { quickReset, testUsers, testHabits, getTestPool } = require('./setup');

describe('Completion Tracking Integration Tests', () => {
  let user1Cookies;
  let user2Cookies;

  // Helper to get today's date in YYYY-MM-DD format
  const getToday = () => new Date().toISOString().split('T')[0];

  // Helper to get a date N days ago
  const getDaysAgo = (n) => {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return date.toISOString().split('T')[0];
  };

  // Reset database and login users before each test
  beforeEach(async () => {
    await quickReset();

    // Login as user 1
    const login1 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUsers.user1.email,
        password: testUsers.user1.password,
      });
    user1Cookies = login1.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

    // Login as user 2
    const login2 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUsers.user2.email,
        password: testUsers.user2.password,
      });
    user2Cookies = login2.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  });

  describe('Create Completion (POST /api/v1/habits/:habitId/completions)', () => {
    it('should create a completion and verify in database', async () => {
      const today = getToday();

      const response = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: today });

      expect(response.status).toBe(201);
      expect(response.body.habitId).toBe(testHabits.exercise);
      expect(response.body.date).toBe(today);
      expect(response.body.id).toBeDefined();

      // Verify in database
      const pool = getTestPool();
      const result = await pool.query(
        'SELECT * FROM completions WHERE id = $1',
        [response.body.id]
      );
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].habit_id).toBe(testHabits.exercise);
      expect(result.rows[0].date.toISOString().split('T')[0]).toBe(today);
    });

    it('should create a completion with notes', async () => {
      const today = getToday();
      const notes = 'Great workout today!';

      const response = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: today, notes });

      expect(response.status).toBe(201);
      expect(response.body.notes).toBe(notes);

      // Verify notes in database
      const pool = getTestPool();
      const result = await pool.query(
        'SELECT notes FROM completions WHERE id = $1',
        [response.body.id]
      );
      expect(result.rows[0].notes).toBe(notes);
    });

    it('should create completions for past dates', async () => {
      const pastDate = getDaysAgo(5);

      const response = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: pastDate });

      expect(response.status).toBe(201);
      expect(response.body.date).toBe(pastDate);
    });

    it('should return 400 for missing date', async () => {
      const response = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.toLowerCase()).toContain('date');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: 'not-a-date' });

      expect(response.status).toBe(400);
      expect(response.body.error.toLowerCase()).toContain('date');
    });

    it('should return 400 for future date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: futureDate });

      expect(response.status).toBe(400);
      expect(response.body.error.toLowerCase()).toContain('future');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .send({ date: getToday() });

      expect(response.status).toBe(401);
    });
  });

  describe('Duplicate Prevention', () => {
    it('should return 409 when creating duplicate completion for same date', async () => {
      const today = getToday();

      // Create first completion
      const first = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: today });

      expect(first.status).toBe(201);

      // Try to create duplicate
      const duplicate = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: today });

      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.toLowerCase()).toContain('already');
    });

    it('should allow same date completion for different habits', async () => {
      const today = getToday();

      // Create completion for exercise habit
      const first = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: today });

      expect(first.status).toBe(201);

      // Create completion for reading habit (same date, different habit)
      const second = await request(app)
        .post(`/api/v1/habits/${testHabits.reading}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: today });

      expect(second.status).toBe(201);

      // Verify both exist in database
      const pool = getTestPool();
      const result = await pool.query(
        'SELECT habit_id FROM completions WHERE date = $1',
        [today]
      );
      expect(result.rows.length).toBe(2);
    });

    it('should allow different dates for same habit', async () => {
      const today = getToday();
      const yesterday = getDaysAgo(1);

      // Create completion for today
      const first = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: today });

      expect(first.status).toBe(201);

      // Create completion for yesterday
      const second = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: yesterday });

      expect(second.status).toBe(201);

      // Verify both exist
      const pool = getTestPool();
      const result = await pool.query(
        'SELECT date FROM completions WHERE habit_id = $1 ORDER BY date',
        [testHabits.exercise]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('Read Completions (GET /api/v1/habits/:habitId/completions)', () => {
    beforeEach(async () => {
      // Create some completions for testing
      const pool = getTestPool();
      await pool.query(
        `INSERT INTO completions (habit_id, date, notes)
         VALUES
           ($1, $2, 'Day 1'),
           ($1, $3, 'Day 2'),
           ($1, $4, 'Day 3'),
           ($1, $5, 'Day 4'),
           ($1, $6, 'Day 5')`,
        [
          testHabits.exercise,
          getDaysAgo(0),
          getDaysAgo(1),
          getDaysAgo(2),
          getDaysAgo(5),
          getDaysAgo(10),
        ]
      );
    });

    it('should return all completions for a habit', async () => {
      const response = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(5);

      // Should be ordered by date descending
      const dates = response.body.map(c => c.date);
      const sortedDates = [...dates].sort().reverse();
      expect(dates).toEqual(sortedDates);
    });

    it('should filter completions by startDate', async () => {
      const startDate = getDaysAgo(3);

      const response = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions?startDate=${startDate}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(200);
      // Should only include completions from day 0, 1, 2 (days ago)
      expect(response.body.length).toBe(3);
      response.body.forEach(c => {
        expect(c.date >= startDate).toBe(true);
      });
    });

    it('should filter completions by endDate', async () => {
      const endDate = getDaysAgo(3);

      const response = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions?endDate=${endDate}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(200);
      // Should only include completions from day 5 and 10 (days ago)
      expect(response.body.length).toBe(2);
      response.body.forEach(c => {
        expect(c.date <= endDate).toBe(true);
      });
    });

    it('should filter completions by date range', async () => {
      const startDate = getDaysAgo(6);
      const endDate = getDaysAgo(1);

      const response = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions?startDate=${startDate}&endDate=${endDate}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(200);
      // Should include days 1, 2, and 5 ago
      expect(response.body.length).toBe(3);
      response.body.forEach(c => {
        expect(c.date >= startDate).toBe(true);
        expect(c.date <= endDate).toBe(true);
      });
    });

    it('should return empty array for habit with no completions', async () => {
      const response = await request(app)
        .get(`/api/v1/habits/${testHabits.reading}/completions`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return empty array for date range with no completions', async () => {
      const startDate = getDaysAgo(100);
      const endDate = getDaysAgo(90);

      const response = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions?startDate=${startDate}&endDate=${endDate}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 404 for non-existent habit', async () => {
      const response = await request(app)
        .get('/api/v1/habits/99999999-9999-9999-9999-999999999999/completions')
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions`);

      expect(response.status).toBe(401);
    });
  });

  describe('Delete Completion (DELETE /api/v1/habits/:habitId/completions/:date)', () => {
    it('should delete a completion and verify removal from database', async () => {
      const today = getToday();
      const pool = getTestPool();

      // Create a completion first
      await pool.query(
        'INSERT INTO completions (habit_id, date) VALUES ($1, $2)',
        [testHabits.exercise, today]
      );

      // Verify it exists
      const beforeDelete = await pool.query(
        'SELECT id FROM completions WHERE habit_id = $1 AND date = $2',
        [testHabits.exercise, today]
      );
      expect(beforeDelete.rows.length).toBe(1);

      // Delete via API
      const response = await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}/completions/${today}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
      expect(response.body.habitId).toBe(testHabits.exercise);
      expect(response.body.date).toBe(today);

      // Verify removal from database
      const afterDelete = await pool.query(
        'SELECT id FROM completions WHERE habit_id = $1 AND date = $2',
        [testHabits.exercise, today]
      );
      expect(afterDelete.rows.length).toBe(0);
    });

    it('should return 404 when deleting non-existent completion', async () => {
      const response = await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}/completions/${getToday()}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should return 404 for non-existent habit', async () => {
      const response = await request(app)
        .delete(`/api/v1/habits/99999999-9999-9999-9999-999999999999/completions/${getToday()}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}/completions/invalid-date`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(400);
      expect(response.body.error.toLowerCase()).toContain('date');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}/completions/${getToday()}`);

      expect(response.status).toBe(401);
    });

    it('should not affect other completions when deleting one', async () => {
      const pool = getTestPool();
      const today = getToday();
      const yesterday = getDaysAgo(1);

      // Create two completions
      await pool.query(
        `INSERT INTO completions (habit_id, date)
         VALUES ($1, $2), ($1, $3)`,
        [testHabits.exercise, today, yesterday]
      );

      // Delete only today's completion
      await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}/completions/${today}`)
        .set('Cookie', user1Cookies);

      // Verify yesterday's completion still exists
      const result = await pool.query(
        'SELECT date FROM completions WHERE habit_id = $1',
        [testHabits.exercise]
      );
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].date.toISOString().split('T')[0]).toBe(yesterday);
    });
  });

  describe('Habit Ownership Validation', () => {
    it('should not allow user 1 to create completion for user 2 habit', async () => {
      const response = await request(app)
        .post(`/api/v1/habits/${testHabits.user2Habit}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: getToday() });

      expect(response.status).toBe(403);
      expect(response.body.error.toLowerCase()).toContain('access');
    });

    it('should not allow user 1 to read completions for user 2 habit', async () => {
      const response = await request(app)
        .get(`/api/v1/habits/${testHabits.user2Habit}/completions`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(403);
      expect(response.body.error.toLowerCase()).toContain('access');
    });

    it('should not allow user 1 to delete completion from user 2 habit', async () => {
      const pool = getTestPool();
      const today = getToday();

      // Create completion for user 2's habit
      await pool.query(
        'INSERT INTO completions (habit_id, date) VALUES ($1, $2)',
        [testHabits.user2Habit, today]
      );

      // User 1 tries to delete it
      const response = await request(app)
        .delete(`/api/v1/habits/${testHabits.user2Habit}/completions/${today}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(403);

      // Verify completion still exists
      const result = await pool.query(
        'SELECT id FROM completions WHERE habit_id = $1 AND date = $2',
        [testHabits.user2Habit, today]
      );
      expect(result.rows.length).toBe(1);
    });

    it('should allow user 2 to manage their own habit completions', async () => {
      const today = getToday();

      // User 2 creates completion
      const createResponse = await request(app)
        .post(`/api/v1/habits/${testHabits.user2Habit}/completions`)
        .set('Cookie', user2Cookies)
        .send({ date: today });

      expect(createResponse.status).toBe(201);

      // User 2 reads completions
      const readResponse = await request(app)
        .get(`/api/v1/habits/${testHabits.user2Habit}/completions`)
        .set('Cookie', user2Cookies);

      expect(readResponse.status).toBe(200);
      expect(readResponse.body.length).toBe(1);

      // User 2 deletes completion
      const deleteResponse = await request(app)
        .delete(`/api/v1/habits/${testHabits.user2Habit}/completions/${today}`)
        .set('Cookie', user2Cookies);

      expect(deleteResponse.status).toBe(200);
    });

    it('should isolate completions between users even for same dates', async () => {
      const today = getToday();

      // User 1 creates completion for their habit
      await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: today });

      // User 2 creates completion for their habit
      await request(app)
        .post(`/api/v1/habits/${testHabits.user2Habit}/completions`)
        .set('Cookie', user2Cookies)
        .send({ date: today });

      // User 1 should only see their completion
      const user1Completions = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies);

      expect(user1Completions.body.length).toBe(1);
      expect(user1Completions.body[0].habitId).toBe(testHabits.exercise);

      // User 2 should only see their completion
      const user2Completions = await request(app)
        .get(`/api/v1/habits/${testHabits.user2Habit}/completions`)
        .set('Cookie', user2Cookies);

      expect(user2Completions.body.length).toBe(1);
      expect(user2Completions.body[0].habitId).toBe(testHabits.user2Habit);
    });
  });

  describe('Full Completion Workflow', () => {
    it('should complete create, read, delete cycle', async () => {
      const today = getToday();
      const notes = 'Completed full workflow test';

      // CREATE
      const createResponse = await request(app)
        .post(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies)
        .send({ date: today, notes });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.date).toBe(today);
      expect(createResponse.body.notes).toBe(notes);

      // READ - verify in list
      const readResponse = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies);

      expect(readResponse.status).toBe(200);
      const completion = readResponse.body.find(c => c.date === today);
      expect(completion).toBeDefined();
      expect(completion.notes).toBe(notes);

      // DELETE
      const deleteResponse = await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}/completions/${today}`)
        .set('Cookie', user1Cookies);

      expect(deleteResponse.status).toBe(200);

      // Verify deletion
      const finalRead = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies);

      const deletedCompletion = finalRead.body.find(c => c.date === today);
      expect(deletedCompletion).toBeUndefined();
    });

    it('should track multiple days of completions', async () => {
      const dates = [
        getToday(),
        getDaysAgo(1),
        getDaysAgo(2),
        getDaysAgo(3),
        getDaysAgo(4),
        getDaysAgo(5),
        getDaysAgo(6),
      ];

      // Create completions for a full week
      for (const date of dates) {
        const response = await request(app)
          .post(`/api/v1/habits/${testHabits.exercise}/completions`)
          .set('Cookie', user1Cookies)
          .send({ date });

        expect(response.status).toBe(201);
      }

      // Verify all completions exist
      const response = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(7);

      // Verify we can filter to this week
      const weekStart = getDaysAgo(6);
      const filteredResponse = await request(app)
        .get(`/api/v1/habits/${testHabits.exercise}/completions?startDate=${weekStart}`)
        .set('Cookie', user1Cookies);

      expect(filteredResponse.body.length).toBe(7);
    });
  });
});
