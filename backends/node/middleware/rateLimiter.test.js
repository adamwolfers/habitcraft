const request = require('supertest');

// Mock the database pool - must be before requiring app
jest.mock('../db/pool');

// Note: These tests verify rate limiting behavior on auth endpoints.
// We must disable SKIP_RATE_LIMIT to actually test rate limiting.

describe('Rate Limiter Exports', () => {
  it('should export passwordChangeLimiter', () => {
    const { passwordChangeLimiter } = require('./rateLimiter');
    expect(passwordChangeLimiter).toBeDefined();
    expect(typeof passwordChangeLimiter).toBe('function');
  });
});

describe('Rate Limiting', () => {
  let app;
  let pool;

  beforeAll(() => {
    // Disable skip for rate limiter tests - must be set before requiring app
    process.env.SKIP_RATE_LIMIT = 'false';
    // Clear require cache to reload app with new env
    jest.resetModules();
    // Re-require after reset to get the mocked versions
    pool = require('../db/pool');
    app = require('../app');
  });

  afterAll(() => {
    // Restore skip for other tests
    process.env.SKIP_RATE_LIMIT = 'true';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock database to return empty results (user not found = 401)
    pool.query.mockResolvedValue({ rows: [] });
  });

  describe('POST /api/v1/auth/login rate limiting', () => {
    it('should return 429 after exceeding login attempt limit', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Make 5 requests (within limit) - these should return 401 (invalid credentials)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send(loginData);
        expect(response.status).toBe(401);
      }

      // 6th request should be rate limited (429)
      const rateLimitedResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body.error).toBe('Too many login attempts');
    });

    it('should include rate limit headers in response', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'test' });

      // Standard rate limit headers should be present
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
    });
  });

  describe('POST /api/v1/auth/register rate limiting', () => {
    it('should return 429 after exceeding registration attempt limit', async () => {
      // Mock: user doesn't exist (allows registration attempt), but then fail insert
      // This simulates multiple registration attempts
      pool.query.mockResolvedValue({ rows: [] });

      // Make 10 requests (within limit) - will get 500 due to no insert result, but that's ok
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `spammer${i}@example.com`,
            password: 'password123',
            name: 'Spammer'
          });
      }

      // 11th request should be rate limited (429)
      const rateLimitedResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'spammer10@example.com',
          password: 'password123',
          name: 'Spammer'
        });

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body.error).toBe('Too many registration attempts');
    });
  });

  describe('POST /api/v1/auth/refresh rate limiting', () => {
    it('should return 429 after exceeding refresh attempt limit', async () => {
      // Make 30 requests (within limit)
      for (let i = 0; i < 30; i++) {
        const response = await request(app)
          .post('/api/v1/auth/refresh')
          .send({});
        // Will return 400 (no token) - that's expected
        expect(response.status).toBe(400);
      }

      // 31st request should be rate limited (429)
      const rateLimitedResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body.error).toBe('Too many refresh attempts');
    });
  });
});
