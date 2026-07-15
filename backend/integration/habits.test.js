/**
 * Habit CRUD Integration Tests
 *
 * Tests habit operations against the real test database.
 *
 * Test fixtures (from setup.js):
 * - User 1: test@example.com - has 3 habits (exercise, reading, archived)
 * - User 2: test2@example.com - has 1 habit (user2Habit)
 */

const request = require('supertest');
const app = require('../app');
const { quickReset, testUsers, testHabits, getTestPool } = require('./setup');

describe('Habit CRUD Integration Tests', () => {
  let user1Cookies;
  let user2Cookies;

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

  describe('Create Habit (POST /api/v1/habits)', () => {
    it('should create a new habit with required fields', async () => {
      const newHabit = {
        name: 'Meditation',
        frequency: 'daily',
      };

      const response = await request(app)
        .post('/api/v1/habits')
        .set('Cookie', user1Cookies)
        .send(newHabit);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(newHabit.name);
      expect(response.body.frequency).toBe(newHabit.frequency);
      expect(response.body.userId).toBe(testUsers.user1.id);
      expect(response.body.id).toBeDefined();
      expect(response.body.status).toBe('active');

      // Verify in database
      const pool = getTestPool();
      const result = await pool.query(
        'SELECT * FROM habits WHERE id = $1',
        [response.body.id]
      );
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe(newHabit.name);
    });

    it('should create a habit with all optional fields', async () => {
      const newHabit = {
        name: 'Weekly Review',
        description: 'Review weekly goals and progress',
        frequency: 'weekly',
        targetDays: [1, 5], // Monday=1, Friday=5 (0=Sunday through 6=Saturday)
        color: '#8B5CF6',
        icon: '📝',
      };

      const response = await request(app)
        .post('/api/v1/habits')
        .set('Cookie', user1Cookies)
        .send(newHabit);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(newHabit.name);
      expect(response.body.description).toBe(newHabit.description);
      expect(response.body.frequency).toBe(newHabit.frequency);
      expect(response.body.targetDays).toEqual(newHabit.targetDays);
      expect(response.body.color).toBe(newHabit.color);
      expect(response.body.icon).toBe(newHabit.icon);
    });

    it('should apply default values for optional fields', async () => {
      const newHabit = {
        name: 'Simple Habit',
        frequency: 'daily',
      };

      const response = await request(app)
        .post('/api/v1/habits')
        .set('Cookie', user1Cookies)
        .send(newHabit);

      expect(response.status).toBe(201);
      expect(response.body.color).toBe('#3B82F6'); // Default color
      expect(response.body.icon).toBe('⭐'); // Default icon
      expect(response.body.status).toBe('active');
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/v1/habits')
        .set('Cookie', user1Cookies)
        .send({ frequency: 'daily' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.message).toContain('name');
    });

    it('should return 400 for missing frequency', async () => {
      const response = await request(app)
        .post('/api/v1/habits')
        .set('Cookie', user1Cookies)
        .send({ name: 'Test Habit' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.message).toContain('frequency');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/habits')
        .send({ name: 'Test', frequency: 'daily' });

      expect(response.status).toBe(401);
    });
  });

  describe('Read Habits (GET /api/v1/habits)', () => {
    it('should return all active habits for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // User 1 has 3 habits total (2 active + 1 archived)
      // By default, should return all habits without filtering
      expect(response.body.length).toBe(3);

      const habitNames = response.body.map(h => h.name);
      expect(habitNames).toContain('Morning Exercise');
      expect(habitNames).toContain('Read Books');
      expect(habitNames).toContain('Archived Habit');
    });

    it('should filter habits by status', async () => {
      const activeResponse = await request(app)
        .get('/api/v1/habits?status=active')
        .set('Cookie', user1Cookies);

      expect(activeResponse.status).toBe(200);
      expect(activeResponse.body.length).toBe(2);
      activeResponse.body.forEach(habit => {
        expect(habit.status).toBe('active');
      });

      const archivedResponse = await request(app)
        .get('/api/v1/habits?status=archived')
        .set('Cookie', user1Cookies);

      expect(archivedResponse.status).toBe(200);
      expect(archivedResponse.body.length).toBe(1);
      expect(archivedResponse.body[0].name).toBe('Archived Habit');
    });

    it('should return empty array for user with no habits', async () => {
      // Clear user 2's habits
      const pool = getTestPool();
      await pool.query('DELETE FROM habits WHERE user_id = $1', [testUsers.user2.id]);

      const response = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', user2Cookies);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/habits');

      expect(response.status).toBe(401);
    });
  });

  describe('Update Habit (PUT /api/v1/habits/:id)', () => {
    it('should update habit name and frequency', async () => {
      const updates = {
        name: 'Evening Exercise',
        frequency: 'daily',
      };

      const response = await request(app)
        .put(`/api/v1/habits/${testHabits.exercise}`)
        .set('Cookie', user1Cookies)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updates.name);
      expect(response.body.id).toBe(testHabits.exercise);

      // Verify in database
      const pool = getTestPool();
      const result = await pool.query(
        'SELECT name FROM habits WHERE id = $1',
        [testHabits.exercise]
      );
      expect(result.rows[0].name).toBe(updates.name);
    });

    it('should update all habit fields', async () => {
      const updates = {
        name: 'Updated Habit',
        description: 'Updated description',
        frequency: 'weekly',
        targetDays: [2, 4], // Tuesday=2, Thursday=4 (0=Sunday through 6=Saturday)
        color: '#EF4444',
        icon: '🎯',
        status: 'archived',
      };

      const response = await request(app)
        .put(`/api/v1/habits/${testHabits.exercise}`)
        .set('Cookie', user1Cookies)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updates.name);
      expect(response.body.description).toBe(updates.description);
      expect(response.body.frequency).toBe(updates.frequency);
      expect(response.body.targetDays).toEqual(updates.targetDays);
      expect(response.body.color).toBe(updates.color);
      expect(response.body.icon).toBe(updates.icon);
      expect(response.body.status).toBe(updates.status);
    });

    it('should return 404 for non-existent habit', async () => {
      const response = await request(app)
        .put('/api/v1/habits/99999999-9999-9999-9999-999999999999')
        .set('Cookie', user1Cookies)
        .send({ name: 'Test', frequency: 'daily' });

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid habit ID format', async () => {
      const response = await request(app)
        .put('/api/v1/habits/invalid!@#id')
        .set('Cookie', user1Cookies)
        .send({ name: 'Test', frequency: 'daily' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .put(`/api/v1/habits/${testHabits.exercise}`)
        .set('Cookie', user1Cookies)
        .send({ description: 'Only description' });

      expect(response.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put(`/api/v1/habits/${testHabits.exercise}`)
        .send({ name: 'Test', frequency: 'daily' });

      expect(response.status).toBe(401);
    });
  });

  describe('Delete Habit (DELETE /api/v1/habits/:id)', () => {
    it('should delete habit successfully', async () => {
      const response = await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(204);

      // Verify deleted from database
      const pool = getTestPool();
      const result = await pool.query(
        'SELECT id FROM habits WHERE id = $1',
        [testHabits.exercise]
      );
      expect(result.rows.length).toBe(0);
    });

    it('should return 404 for non-existent habit', async () => {
      const response = await request(app)
        .delete('/api/v1/habits/99999999-9999-9999-9999-999999999999')
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid habit ID format', async () => {
      const response = await request(app)
        .delete('/api/v1/habits/invalid!@#id')
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}`);

      expect(response.status).toBe(401);
    });
  });

  describe('User Isolation', () => {
    it('should not return other users habits in list', async () => {
      const user1Response = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', user1Cookies);

      const user2Response = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', user2Cookies);

      // User 1 should only see their habits
      const user1HabitIds = user1Response.body.map(h => h.id);
      expect(user1HabitIds).toContain(testHabits.exercise);
      expect(user1HabitIds).toContain(testHabits.reading);
      expect(user1HabitIds).not.toContain(testHabits.user2Habit);

      // User 2 should only see their habits
      const user2HabitIds = user2Response.body.map(h => h.id);
      expect(user2HabitIds).toContain(testHabits.user2Habit);
      expect(user2HabitIds).not.toContain(testHabits.exercise);
    });

    it('should not allow user to update another users habit', async () => {
      const response = await request(app)
        .put(`/api/v1/habits/${testHabits.user2Habit}`)
        .set('Cookie', user1Cookies)
        .send({ name: 'Hacked!', frequency: 'daily' });

      expect(response.status).toBe(404);

      // Verify habit unchanged
      const pool = getTestPool();
      const result = await pool.query(
        'SELECT name FROM habits WHERE id = $1',
        [testHabits.user2Habit]
      );
      expect(result.rows[0].name).toBe('User 2 Habit');
    });

    it('should not allow user to delete another users habit', async () => {
      const response = await request(app)
        .delete(`/api/v1/habits/${testHabits.user2Habit}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(404);

      // Verify habit still exists
      const pool = getTestPool();
      const result = await pool.query(
        'SELECT id FROM habits WHERE id = $1',
        [testHabits.user2Habit]
      );
      expect(result.rows.length).toBe(1);
    });

    it('should isolate newly created habits to the creating user', async () => {
      // User 1 creates a habit
      const createResponse = await request(app)
        .post('/api/v1/habits')
        .set('Cookie', user1Cookies)
        .send({ name: 'User 1 Secret Habit', frequency: 'daily' });

      const newHabitId = createResponse.body.id;

      // User 2 should not see it
      const user2Habits = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', user2Cookies);

      const user2HabitIds = user2Habits.body.map(h => h.id);
      expect(user2HabitIds).not.toContain(newHabitId);

      // User 2 should not be able to update it
      const updateResponse = await request(app)
        .put(`/api/v1/habits/${newHabitId}`)
        .set('Cookie', user2Cookies)
        .send({ name: 'Stolen!', frequency: 'daily' });

      expect(updateResponse.status).toBe(404);

      // User 2 should not be able to delete it
      const deleteResponse = await request(app)
        .delete(`/api/v1/habits/${newHabitId}`)
        .set('Cookie', user2Cookies);

      expect(deleteResponse.status).toBe(404);
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete associated completions when habit is deleted', async () => {
      const pool = getTestPool();

      // Create a completion for the exercise habit
      await pool.query(
        `INSERT INTO completions (habit_id, date, notes)
         VALUES ($1, CURRENT_DATE, 'Test completion')`,
        [testHabits.exercise]
      );

      // Verify completion exists
      const beforeDelete = await pool.query(
        'SELECT id FROM completions WHERE habit_id = $1',
        [testHabits.exercise]
      );
      expect(beforeDelete.rows.length).toBe(1);

      // Delete the habit
      const response = await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}`)
        .set('Cookie', user1Cookies);

      expect(response.status).toBe(204);

      // Verify completions are also deleted (via ON DELETE CASCADE)
      const afterDelete = await pool.query(
        'SELECT id FROM completions WHERE habit_id = $1',
        [testHabits.exercise]
      );
      expect(afterDelete.rows.length).toBe(0);
    });

    it('should delete multiple completions when habit is deleted', async () => {
      const pool = getTestPool();

      // Create multiple completions
      await pool.query(
        `INSERT INTO completions (habit_id, date, notes)
         VALUES
           ($1, CURRENT_DATE, 'Completion 1'),
           ($1, CURRENT_DATE - INTERVAL '1 day', 'Completion 2'),
           ($1, CURRENT_DATE - INTERVAL '2 days', 'Completion 3')`,
        [testHabits.exercise]
      );

      // Verify completions exist
      const beforeDelete = await pool.query(
        'SELECT id FROM completions WHERE habit_id = $1',
        [testHabits.exercise]
      );
      expect(beforeDelete.rows.length).toBe(3);

      // Delete the habit
      await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}`)
        .set('Cookie', user1Cookies);

      // Verify all completions are deleted
      const afterDelete = await pool.query(
        'SELECT id FROM completions WHERE habit_id = $1',
        [testHabits.exercise]
      );
      expect(afterDelete.rows.length).toBe(0);
    });

    it('should not affect other habits completions when one habit is deleted', async () => {
      const pool = getTestPool();

      // Create completions for both habits
      await pool.query(
        `INSERT INTO completions (habit_id, date, notes)
         VALUES
           ($1, CURRENT_DATE, 'Exercise completion'),
           ($2, CURRENT_DATE, 'Reading completion')`,
        [testHabits.exercise, testHabits.reading]
      );

      // Delete exercise habit
      await request(app)
        .delete(`/api/v1/habits/${testHabits.exercise}`)
        .set('Cookie', user1Cookies);

      // Verify reading habit completions still exist
      const readingCompletions = await pool.query(
        'SELECT id FROM completions WHERE habit_id = $1',
        [testHabits.reading]
      );
      expect(readingCompletions.rows.length).toBe(1);
    });
  });

  describe('Full CRUD Workflow', () => {
    it('should complete a full create, read, update, delete cycle', async () => {
      // CREATE
      const createResponse = await request(app)
        .post('/api/v1/habits')
        .set('Cookie', user1Cookies)
        .send({
          name: 'Full CRUD Test',
          description: 'Testing complete workflow',
          frequency: 'daily',
          color: '#22C55E',
          icon: '✅',
        });

      expect(createResponse.status).toBe(201);
      const habitId = createResponse.body.id;

      // READ - verify in list
      const listResponse = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', user1Cookies);

      const createdHabit = listResponse.body.find(h => h.id === habitId);
      expect(createdHabit).toBeDefined();
      expect(createdHabit.name).toBe('Full CRUD Test');

      // UPDATE
      const updateResponse = await request(app)
        .put(`/api/v1/habits/${habitId}`)
        .set('Cookie', user1Cookies)
        .send({
          name: 'Updated CRUD Test',
          frequency: 'weekly',
          description: 'Updated description',
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.name).toBe('Updated CRUD Test');
      expect(updateResponse.body.frequency).toBe('weekly');

      // DELETE
      const deleteResponse = await request(app)
        .delete(`/api/v1/habits/${habitId}`)
        .set('Cookie', user1Cookies);

      expect(deleteResponse.status).toBe(204);

      // Verify deletion
      const finalList = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', user1Cookies);

      const deletedHabit = finalList.body.find(h => h.id === habitId);
      expect(deletedHabit).toBeUndefined();
    });
  });
});
