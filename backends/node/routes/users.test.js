const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const jwt = require('jsonwebtoken');

// Mock the database pool
jest.mock('../db/pool');

describe('Users API', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/users/me', () => {
    it('should return user profile with valid token', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString()
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User'
      });
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/v1/users/me');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should return 404 if user not found', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });
});
