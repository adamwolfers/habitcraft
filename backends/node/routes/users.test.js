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

  describe('PUT /api/v1/users/me', () => {
    it('should update user name with valid token', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const updatedUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Updated Name',
        createdAt: new Date().toISOString()
      };

      pool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });

    it('should return 400 for empty name', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Name is required');
    });

    it('should return 400 for whitespace-only name', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Name is required');
    });

    it('should return 400 when name field is missing', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Name is required');
    });

    it('should return 400 for name exceeding max length', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const longName = 'a'.repeat(101);

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: longName });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Name must be 100 characters or less');
    });

    it('should trim whitespace from name', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const updatedUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Trimmed Name',
        createdAt: new Date().toISOString()
      };

      pool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '  Trimmed Name  ' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Trimmed Name');
    });

    it('should return 404 if user not found', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return all expected user fields', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const updatedUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Updated Name',
        createdAt: '2025-01-15T10:30:00.000Z'
      };

      pool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: mockUserId,
        email: 'test@example.com',
        name: 'Updated Name',
        createdAt: '2025-01-15T10:30:00.000Z'
      });
    });
  });
});
