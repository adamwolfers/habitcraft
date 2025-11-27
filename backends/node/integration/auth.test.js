/**
 * Authentication Integration Tests
 *
 * Tests authentication flows against the real test database.
 *
 * Test credentials (from test-fixtures.sql):
 * - User 1: test@example.com / Test1234!
 * - User 2: test2@example.com / Test1234!
 */

const request = require('supertest');
const app = require('../app');
const { quickReset, testUsers, getTestPool } = require('./setup');

describe('Authentication Integration Tests', () => {
  // Reset database before each test to ensure clean state
  beforeEach(async () => {
    await quickReset();
  });

  describe('Register → Login → Access Protected Route', () => {
    it('should complete full registration and authentication flow', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'NewUser123!',
        name: 'New User',
      };

      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(newUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user.email).toBe(newUser.email);
      expect(registerResponse.body.user.name).toBe(newUser.name);

      // Verify cookies are set
      const registerCookies = registerResponse.headers['set-cookie'];
      expect(registerCookies).toBeDefined();
      expect(registerCookies.some(c => c.startsWith('accessToken='))).toBe(true);

      // Step 2: Verify user exists in database
      const pool = getTestPool();
      const dbUser = await pool.query(
        'SELECT id, email, name FROM users WHERE email = $1',
        [newUser.email]
      );
      expect(dbUser.rows.length).toBe(1);
      expect(dbUser.rows[0].email).toBe(newUser.email);

      // Step 3: Login with registered credentials
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: newUser.email,
          password: newUser.password,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.email).toBe(newUser.email);

      // Get cookies for authenticated requests
      const cookies = loginResponse.headers['set-cookie'];
      const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

      // Step 4: Access protected route (GET /api/v1/habits)
      const habitsResponse = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', cookieString);

      expect(habitsResponse.status).toBe(200);
      expect(Array.isArray(habitsResponse.body)).toBe(true);
      // New user has no habits yet
      expect(habitsResponse.body.length).toBe(0);

      // Step 5: Access user profile
      const profileResponse = await request(app)
        .get('/api/v1/users/me')
        .set('Cookie', cookieString);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.email).toBe(newUser.email);
      expect(profileResponse.body.name).toBe(newUser.name);
    });

    it('should allow existing test user to login and access their habits', async () => {
      // Login with test user 1 (has pre-existing habits)
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUsers.user1.email,
          password: testUsers.user1.password,
        });

      expect(loginResponse.status).toBe(200);

      const cookies = loginResponse.headers['set-cookie'];
      const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

      // Access habits - should see test user's habits
      const habitsResponse = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', cookieString);

      expect(habitsResponse.status).toBe(200);
      expect(habitsResponse.body.length).toBeGreaterThan(0);

      // Verify we see the expected habits
      const habitNames = habitsResponse.body.map(h => h.name);
      expect(habitNames).toContain('Morning Exercise');
      expect(habitNames).toContain('Read Books');
    });
  });

  describe('Login → Token Refresh → Continue Session', () => {
    it('should refresh access token and continue session', async () => {
      // Step 1: Login
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUsers.user1.email,
          password: testUsers.user1.password,
        });

      expect(loginResponse.status).toBe(200);

      const cookies = loginResponse.headers['set-cookie'];
      const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

      // Step 2: Refresh token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookieString);

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.accessToken).toBeDefined();

      // Get new cookies
      const newCookies = refreshResponse.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      const newCookieString = newCookies.map(c => c.split(';')[0]).join('; ');

      // Step 3: Continue session with new token
      const habitsResponse = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', newCookieString);

      expect(habitsResponse.status).toBe(200);
      expect(habitsResponse.body.length).toBeGreaterThan(0);
    });

    it('should reject refresh with invalid/missing refresh token', async () => {
      // Try to refresh without any cookies - returns 400 (bad request)
      const response = await request(app)
        .post('/api/v1/auth/refresh');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });

  describe('Invalid Credentials → Proper Error Response', () => {
    it('should return 401 for wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUsers.user1.email,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      // Error should be generic (not revealing which field is wrong)
      expect(response.body.error.toLowerCase()).toContain('invalid');
    });

    it('should return 401 for non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      // Error should be generic (prevent user enumeration)
      expect(response.body.error.toLowerCase()).toContain('invalid');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'somepassword',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'notanemail',
          password: 'somepassword',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 409 for duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUsers.user1.email, // Already exists
          password: 'NewPass123!',
          name: 'Duplicate User',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.toLowerCase()).toContain('email');
    });
  });

  describe('User Isolation Verification', () => {
    it('should not allow user 1 to access user 2 habits', async () => {
      // Login as user 1
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUsers.user1.email,
          password: testUsers.user1.password,
        });

      const cookies = loginResponse.headers['set-cookie'];
      const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

      // Get user 1's habits
      const habitsResponse = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', cookieString);

      expect(habitsResponse.status).toBe(200);

      // Verify we don't see user 2's habits
      const habitNames = habitsResponse.body.map(h => h.name);
      expect(habitNames).not.toContain('User 2 Habit');
    });

    it('should not allow user 1 to modify user 2 habits', async () => {
      // Login as user 1
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUsers.user1.email,
          password: testUsers.user1.password,
        });

      const cookies = loginResponse.headers['set-cookie'];
      const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

      // Try to update user 2's habit with valid data (should fail with 404)
      const updateResponse = await request(app)
        .put('/api/v1/habits/dddddddd-dddd-dddd-dddd-dddddddddddd')
        .set('Cookie', cookieString)
        .send({
          name: 'Hacked Habit',
          frequency: 'daily',
        });

      expect(updateResponse.status).toBe(404);
    });

    it('should not allow user 1 to delete user 2 habits', async () => {
      // Login as user 1
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUsers.user1.email,
          password: testUsers.user1.password,
        });

      const cookies = loginResponse.headers['set-cookie'];
      const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

      // Try to delete user 2's habit (should fail)
      const deleteResponse = await request(app)
        .delete('/api/v1/habits/dddddddd-dddd-dddd-dddd-dddddddddddd')
        .set('Cookie', cookieString);

      expect(deleteResponse.status).toBe(404);

      // Verify habit still exists in database
      const pool = getTestPool();
      const result = await pool.query(
        'SELECT id FROM habits WHERE id = $1',
        ['dddddddd-dddd-dddd-dddd-dddddddddddd']
      );
      expect(result.rows.length).toBe(1);
    });

    it('should allow each user to only see their own profile', async () => {
      // Login as user 1
      const login1Response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUsers.user1.email,
          password: testUsers.user1.password,
        });

      const cookies1 = login1Response.headers['set-cookie'];
      const cookieString1 = cookies1.map(c => c.split(';')[0]).join('; ');

      // Get user 1's profile
      const profile1Response = await request(app)
        .get('/api/v1/users/me')
        .set('Cookie', cookieString1);

      expect(profile1Response.status).toBe(200);
      expect(profile1Response.body.email).toBe(testUsers.user1.email);
      expect(profile1Response.body.id).toBe(testUsers.user1.id);

      // Login as user 2
      const login2Response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUsers.user2.email,
          password: testUsers.user2.password,
        });

      const cookies2 = login2Response.headers['set-cookie'];
      const cookieString2 = cookies2.map(c => c.split(';')[0]).join('; ');

      // Get user 2's profile
      const profile2Response = await request(app)
        .get('/api/v1/users/me')
        .set('Cookie', cookieString2);

      expect(profile2Response.status).toBe(200);
      expect(profile2Response.body.email).toBe(testUsers.user2.email);
      expect(profile2Response.body.id).toBe(testUsers.user2.id);
    });
  });

  describe('Logout Flow', () => {
    it('should logout and invalidate session', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUsers.user1.email,
          password: testUsers.user1.password,
        });

      const cookies = loginResponse.headers['set-cookie'];
      const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

      // Verify session works
      const habitsResponse = await request(app)
        .get('/api/v1/habits')
        .set('Cookie', cookieString);
      expect(habitsResponse.status).toBe(200);

      // Logout
      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookieString);

      expect(logoutResponse.status).toBe(200);

      // Verify cookies are cleared
      const logoutCookies = logoutResponse.headers['set-cookie'];
      expect(logoutCookies.some(c => c.includes('accessToken=;'))).toBe(true);
      expect(logoutCookies.some(c => c.includes('refreshToken=;'))).toBe(true);
    });
  });
});
