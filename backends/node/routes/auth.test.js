const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock the database pool
jest.mock('../db/pool');

describe('Auth API', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'Test User'
    };

    it('should register a new user and return tokens', async () => {
      const mockUser = {
        id: mockUserId,
        email: validUser.email,
        name: validUser.name,
        created_at: new Date().toISOString()
      };

      // Mock: check user doesn't exist
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Mock: insert user
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validUser);

      expect(response.status).toBe(201);
      expect(response.body.user).toMatchObject({
        id: mockUserId,
        email: validUser.email,
        name: validUser.name
      });
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.password).toBeUndefined();
    });

    it('should return 409 if email already exists', async () => {
      // Mock: user already exists
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockUserId, email: validUser.email }]
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validUser);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('email');
    });

    it('should return 400 if email is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ password: 'SecurePass123!', name: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 if email is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'SecurePass123!', name: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 if password is too short', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com', password: '123', name: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should hash the password before storing', async () => {
      const mockUser = {
        id: mockUserId,
        email: validUser.email,
        name: validUser.name,
        created_at: new Date().toISOString()
      };

      pool.query.mockResolvedValueOnce({ rows: [] });
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      await request(app)
        .post('/api/v1/auth/register')
        .send(validUser);

      // Check that the INSERT query was called with a hashed password
      const insertCall = pool.query.mock.calls[1];
      const hashedPassword = insertCall[1][1]; // second param is password (email, password, name)
      expect(hashedPassword).not.toBe(validUser.password);
      expect(hashedPassword.startsWith('$2')).toBe(true); // bcrypt hash prefix
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'SecurePass123!'
    };

    it('should login with valid credentials and return tokens', async () => {
      const hashedPassword = await bcrypt.hash(validCredentials.password, 10);
      const mockUser = {
        id: mockUserId,
        email: validCredentials.email,
        name: 'Test User',
        password: hashedPassword,
        created_at: new Date().toISOString()
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validCredentials);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: mockUserId,
        email: validCredentials.email
      });
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.password).toBeUndefined();
    });

    it('should return 401 for non-existent email', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validCredentials);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 401 for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('DifferentPassword123!', 10);
      const mockUser = {
        id: mockUserId,
        email: validCredentials.email,
        password: hashedPassword
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validCredentials);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 400 if email is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'SecurePass123!' });

      expect(response.status).toBe(400);
    });

    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });
  });
});
