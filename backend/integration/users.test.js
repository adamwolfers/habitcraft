/**
 * User Account Integration Tests
 *
 * Tests user profile and account-deletion operations against the real test
 * database.
 *
 * PUT /api/v1/users/me is covered here too (habitcraft-0m77): its unit tests
 * mock the database, so only these cases run it against real rows and put its
 * responses through the OpenAPI response validation every integration
 * response gets.
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
const { requestLimits } = require('../validators/apiLimits.generated');

const PROFILE_LIMITS = requestLimits.updateCurrentUser;

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

  describe('PUT /api/v1/users/me', () => {
    const pool = () => getTestPool();

    const fetchUser1 = async () => {
      const result = await pool().query('SELECT name, email FROM users WHERE id = $1', [
        testUsers.user1.id,
      ]);
      return result.rows[0];
    };

    const updateProfile = (body, cookies = user1Cookies) =>
      request(testServer).put('/api/v1/users/me').set('Cookie', cookies).send(body);

    it('should update the name only and persist it', async () => {
      const response = await updateProfile({ name: 'Renamed User' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: testUsers.user1.id,
        email: testUsers.user1.email,
        name: 'Renamed User',
        createdAt: expect.any(String),
      });
      expect(await fetchUser1()).toEqual({ name: 'Renamed User', email: testUsers.user1.email });
    });

    it('should update the email only, lowercased, and log in with the new one', async () => {
      const before = await fetchUser1();

      const response = await updateProfile({ email: 'New.Address@Example.com' });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('new.address@example.com');
      expect(response.body.name).toBe(before.name);
      expect(await fetchUser1()).toEqual({ name: before.name, email: 'new.address@example.com' });

      await loginAs({ email: 'new.address@example.com', password: testUsers.user1.password });
    });

    it('should update name and email together', async () => {
      const response = await updateProfile({ name: 'Both Changed', email: 'both@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ name: 'Both Changed', email: 'both@example.com' });
      expect(await fetchUser1()).toEqual({ name: 'Both Changed', email: 'both@example.com' });
    });

    it("should accept the user's own current email", async () => {
      const response = await updateProfile({ email: testUsers.user1.email });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(testUsers.user1.email);
    });

    it("should reject another user's email with 409 and leave the account unchanged", async () => {
      const before = await fetchUser1();

      const response = await updateProfile({
        name: 'Should Not Stick',
        email: testUsers.user2.email,
      });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'Email is already in use' });
      expect(await fetchUser1()).toEqual(before);
    });

    it('should reject an empty body', async () => {
      const response = await updateProfile({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual([
        { msg: 'At least one field (name or email) is required' },
      ]);
    });

    it('should reject a name over the limit and leave the account unchanged', async () => {
      const before = await fetchUser1();

      const response = await updateProfile({
        name: 'a'.repeat(PROFILE_LIMITS.name.maxLength + 1),
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'name',
            msg: `Name must be ${PROFILE_LIMITS.name.maxLength} characters or less`,
          }),
        ])
      );
      expect(await fetchUser1()).toEqual(before);
    });

    it('should reject an email over the limit on length', async () => {
      // isEmail rejects any address over 254 characters, so nothing over the
      // 255 limit is well-formed: the format error always comes too. The
      // chain does not bail, so require the length error to be among them --
      // otherwise this would pass on format alone.
      const suffix = '@example.com';
      const email = `${'a'.repeat(PROFILE_LIMITS.email.maxLength + 1 - suffix.length)}${suffix}`;

      const response = await updateProfile({ email });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'email',
            msg: `Email must be ${PROFILE_LIMITS.email.maxLength} characters or less`,
          }),
        ])
      );
    });

    it('should reject a malformed email', async () => {
      const response = await updateProfile({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual([
        expect.objectContaining({ path: 'email', msg: 'Invalid email format' }),
      ]);
    });

    it('should require authentication', async () => {
      const response = await request(testServer)
        .put('/api/v1/users/me')
        .send({ name: 'Anonymous' });

      expect(response.status).toBe(401);
      expect((await fetchUser1()).name).not.toBe('Anonymous');
    });
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
