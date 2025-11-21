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

    it('should register a new user and set HttpOnly cookies', async () => {
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
      expect(response.body.user.password).toBeUndefined();

      // Check HttpOnly cookies are set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.startsWith('accessToken=') && c.includes('HttpOnly'))).toBe(true);
      expect(cookies.some(c => c.startsWith('refreshToken=') && c.includes('HttpOnly'))).toBe(true);
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

    it('should login with valid credentials and set HttpOnly cookies', async () => {
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
      expect(response.body.user.password).toBeUndefined();

      // Check HttpOnly cookies are set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.startsWith('accessToken=') && c.includes('HttpOnly'))).toBe(true);
      expect(cookies.some(c => c.startsWith('refreshToken=') && c.includes('HttpOnly'))).toBe(true);
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

  describe('POST /api/v1/auth/refresh', () => {
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

    it('should return new access token with valid refresh token', async () => {
      const refreshToken = jwt.sign({ userId: mockUserId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
    });

    it('should return 401 for expired refresh token', async () => {
      const refreshToken = jwt.sign({ userId: mockUserId, type: 'refresh' }, JWT_SECRET, { expiresIn: '-1s' });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('expired');
    });

    it('should return 401 for access token used as refresh', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: accessToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token type');
    });

    it('should return 400 if refresh token is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

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
        .get('/api/v1/auth/me')
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
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should return 404 if user not found', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });
  });
});
