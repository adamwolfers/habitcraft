/**
 * User Account Integration Tests
 *
 * Tests user profile and account-deletion operations against the real test
 * database.
 *
 * Why this file exists (habitcraft-3h9): DELETE /api/v1/users/me was broken in
 * production for seven months while its unit tests were green. The route took a
 * transaction client with `pool.connect()`, but `db/pool` exports only
 * { getPool, query, closePool } -- and users.test.js assigned `connect` onto the
 * mocked module, fabricating the exact API production lacked. Only a test that
 * drives the REAL pool can catch that class of bug, so the delete-account cases
 * below must stay integration tests; do not "simplify" them into unit tests.
 *
 * Test fixtures (from setup.js):
 * - User 1: test@example.com - has 3 habits (exercise, reading, archived)
 * - User 2: test2@example.com - has 1 habit (user2Habit)
 */

const request = require('supertest');
const { quickReset, testUsers, testHabits, getTestPool, getTestServer } = require('./setup');

const testServer = getTestServer();

describe('User Account Integration Tests', () => {
  let user1Cookies;

  const loginAs = async (user) => {
    const response = await request(testServer)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password });
    expect(response.status).toBe(200);
    return response.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
  };

  beforeEach(async () => {
    await quickReset();
    user1Cookies = await loginAs(testUsers.user1);
  });

  describe('DELETE /api/v1/users/me', () => {
    it('should delete the account and all related data', async () => {
      const pool = getTestPool();

      // Give user 1 a completion so every table in the FK chain has a row.
      await pool.query('INSERT INTO completions (habit_id, date) VALUES ($1, CURRENT_DATE)', [
        testHabits.exercise,
      ]);

      const response = await request(testServer)
        .delete('/api/v1/users/me')
        .set('Cookie', user1Cookies)
        .send({ password: testUsers.user1.password });

      expect(response.status).toBe(204);

      // Every row belonging to the user is gone...
      const remaining = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM users WHERE id = $1) AS users,
           (SELECT COUNT(*) FROM habits WHERE user_id = $1) AS habits,
           (SELECT COUNT(*) FROM completions c
              JOIN habits h ON h.id = c.habit_id WHERE h.user_id = $1) AS completions,
           (SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1) AS refresh_tokens`,
        [testUsers.user1.id]
      );
      expect(remaining.rows[0]).toEqual({
        users: '0',
        habits: '0',
        completions: '0',
        refresh_tokens: '0',
      });

      // ...and user 2 is untouched.
      const user2 = await pool.query('SELECT COUNT(*) AS habits FROM habits WHERE user_id = $1', [
        testUsers.user2.id,
      ]);
      expect(user2.rows[0].habits).toBe('1');
    });

    it('should reject an incorrect password and leave the account intact', async () => {
      const response = await request(testServer)
        .delete('/api/v1/users/me')
        .set('Cookie', user1Cookies)
        .send({ password: 'WrongPassword123!' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid password');

      const pool = getTestPool();
      const user = await pool.query('SELECT COUNT(*) AS count FROM users WHERE id = $1', [
        testUsers.user1.id,
      ]);
      expect(user.rows[0].count).toBe('1');
    });

    it('should require password confirmation', async () => {
      const response = await request(testServer)
        .delete('/api/v1/users/me')
        .set('Cookie', user1Cookies)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password confirmation required');
    });

    it('should require authentication', async () => {
      const response = await request(testServer)
        .delete('/api/v1/users/me')
        .send({ password: testUsers.user1.password });

      expect(response.status).toBe(401);
    });

    it('should release the pooled client on both success and failure', async () => {
      // A leaked client would exhaust the pool; run more deletes/failures than
      // the default pool size (10) and require the last one to still work.
      for (let i = 0; i < 12; i++) {
        const response = await request(testServer)
          .delete('/api/v1/users/me')
          .set('Cookie', user1Cookies)
          .send({ password: 'WrongPassword123!' });
        expect(response.status).toBe(401);
      }

      const response = await request(testServer)
        .delete('/api/v1/users/me')
        .set('Cookie', user1Cookies)
        .send({ password: testUsers.user1.password });

      expect(response.status).toBe(204);
    });

    it('should leave the session unusable afterwards', async () => {
      const deleteResponse = await request(testServer)
        .delete('/api/v1/users/me')
        .set('Cookie', user1Cookies)
        .send({ password: testUsers.user1.password });
      expect(deleteResponse.status).toBe(204);

      // The access token is still cryptographically valid, but the user row is
      // gone -- the profile route must not resurrect it.
      const profileResponse = await request(testServer)
        .get('/api/v1/users/me')
        .set('Cookie', user1Cookies);

      expect(profileResponse.status).toBe(404);
    });
  });
});
