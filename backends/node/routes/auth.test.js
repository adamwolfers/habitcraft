const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { logSecurityEvent, SECURITY_EVENTS } = require('../utils/securityLogger');

// Mock the database pool
jest.mock('../db/pool');

// Mock the security logger
jest.mock('../utils/securityLogger', () => ({
  logSecurityEvent: jest.fn(),
  SECURITY_EVENTS: {
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILURE: 'LOGIN_FAILURE',
    REGISTER_SUCCESS: 'REGISTER_SUCCESS',
    TOKEN_REFRESH_SUCCESS: 'TOKEN_REFRESH_SUCCESS',
    TOKEN_REFRESH_FAILURE: 'TOKEN_REFRESH_FAILURE',
    LOGOUT: 'LOGOUT',
    AUTH_FAILURE: 'AUTH_FAILURE'
  }
}));

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
        password_hash: hashedPassword,
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
        password_hash: hashedPassword
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

    it('should return new access token when refresh token is in cookie', async () => {
      const refreshToken = jwt.sign({ userId: mockUserId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();

      // Should also set new accessToken cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.startsWith('accessToken=') && c.includes('HttpOnly'))).toBe(true);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear auth cookies', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');

      // Check cookies are cleared (set to empty with past expiry)
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some(c => c.startsWith('refreshToken='))).toBe(true);
    });
  });

  describe('Input sanitization', () => {
    describe('POST /api/v1/auth/register', () => {
      it('should sanitize XSS from name field', async () => {
        const mockUser = {
          id: mockUserId,
          email: 'test@example.com',
          name: 'Test User',
          created_at: new Date().toISOString()
        };

        pool.query.mockResolvedValueOnce({ rows: [] });
        pool.query.mockResolvedValueOnce({ rows: [mockUser] });

        await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'test@example.com',
            password: 'SecurePass123!',
            name: '<script>alert("xss")</script>Test User'
          });

        // Check that the INSERT query was called with sanitized name
        const insertCall = pool.query.mock.calls[1];
        const insertedName = insertCall[1][2]; // third param is name (email, password, name)
        expect(insertedName).toBe('Test User');
        expect(insertedName).not.toContain('<script>');
      });

      it('should trim whitespace from name field', async () => {
        const mockUser = {
          id: mockUserId,
          email: 'test@example.com',
          name: 'Test User',
          created_at: new Date().toISOString()
        };

        pool.query.mockResolvedValueOnce({ rows: [] });
        pool.query.mockResolvedValueOnce({ rows: [mockUser] });

        await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'test@example.com',
            password: 'SecurePass123!',
            name: '  Test User  '
          });

        const insertCall = pool.query.mock.calls[1];
        const insertedName = insertCall[1][2];
        expect(insertedName).toBe('Test User');
      });

      it('should normalize email to lowercase', async () => {
        const mockUser = {
          id: mockUserId,
          email: 'test@example.com',
          name: 'Test User',
          created_at: new Date().toISOString()
        };

        pool.query.mockResolvedValueOnce({ rows: [] });
        pool.query.mockResolvedValueOnce({ rows: [mockUser] });

        await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: '  TEST@EXAMPLE.COM  ',
            password: 'SecurePass123!',
            name: 'Test User'
          });

        // Check both queries use normalized email
        const checkCall = pool.query.mock.calls[0];
        const insertCall = pool.query.mock.calls[1];
        expect(checkCall[1][0]).toBe('test@example.com');
        expect(insertCall[1][0]).toBe('test@example.com');
      });
    });

    describe('POST /api/v1/auth/login', () => {
      it('should normalize email to lowercase for login', async () => {
        const hashedPassword = await bcrypt.hash('SecurePass123!', 10);
        const mockUser = {
          id: mockUserId,
          email: 'test@example.com',
          name: 'Test User',
          password_hash: hashedPassword,
          created_at: new Date().toISOString()
        };

        pool.query.mockResolvedValueOnce({ rows: [mockUser] });

        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: '  TEST@EXAMPLE.COM  ',
            password: 'SecurePass123!'
          });

        // Check query uses normalized email
        const queryCall = pool.query.mock.calls[0];
        expect(queryCall[1][0]).toBe('test@example.com');
      });
    });
  });

  describe('Security Event Logging', () => {
    beforeEach(() => {
      logSecurityEvent.mockClear();
    });

    describe('Login events', () => {
      it('should log LOGIN_SUCCESS on successful login', async () => {
        const hashedPassword = await bcrypt.hash('SecurePass123!', 10);
        const mockUser = {
          id: mockUserId,
          email: 'test@example.com',
          name: 'Test User',
          password_hash: hashedPassword,
          created_at: new Date().toISOString()
        };

        pool.query.mockResolvedValueOnce({ rows: [mockUser] });

        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'test@example.com', password: 'SecurePass123!' });

        expect(logSecurityEvent).toHaveBeenCalledWith(
          SECURITY_EVENTS.LOGIN_SUCCESS,
          expect.any(Object),
          expect.objectContaining({
            email: 'test@example.com',
            userId: mockUserId
          })
        );
      });

      it('should log LOGIN_FAILURE when user not found', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'nonexistent@example.com', password: 'SecurePass123!' });

        expect(logSecurityEvent).toHaveBeenCalledWith(
          SECURITY_EVENTS.LOGIN_FAILURE,
          expect.any(Object),
          expect.objectContaining({
            email: 'nonexistent@example.com',
            reason: 'user_not_found'
          })
        );
      });

      it('should log LOGIN_FAILURE when password is wrong', async () => {
        const hashedPassword = await bcrypt.hash('DifferentPassword!', 10);
        const mockUser = {
          id: mockUserId,
          email: 'test@example.com',
          password_hash: hashedPassword
        };

        pool.query.mockResolvedValueOnce({ rows: [mockUser] });

        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'test@example.com', password: 'WrongPassword123!' });

        expect(logSecurityEvent).toHaveBeenCalledWith(
          SECURITY_EVENTS.LOGIN_FAILURE,
          expect.any(Object),
          expect.objectContaining({
            email: 'test@example.com',
            reason: 'invalid_password'
          })
        );
      });
    });

    describe('Registration events', () => {
      it('should log REGISTER_SUCCESS on successful registration', async () => {
        const mockUser = {
          id: mockUserId,
          email: 'newuser@example.com',
          name: 'New User',
          created_at: new Date().toISOString()
        };

        pool.query.mockResolvedValueOnce({ rows: [] });
        pool.query.mockResolvedValueOnce({ rows: [mockUser] });

        await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'newuser@example.com',
            password: 'SecurePass123!',
            name: 'New User'
          });

        expect(logSecurityEvent).toHaveBeenCalledWith(
          SECURITY_EVENTS.REGISTER_SUCCESS,
          expect.any(Object),
          expect.objectContaining({
            email: 'newuser@example.com',
            userId: mockUserId
          })
        );
      });
    });

    describe('Token refresh events', () => {
      const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

      it('should log TOKEN_REFRESH_SUCCESS on successful refresh', async () => {
        const refreshToken = jwt.sign(
          { userId: mockUserId, type: 'refresh' },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken });

        expect(logSecurityEvent).toHaveBeenCalledWith(
          SECURITY_EVENTS.TOKEN_REFRESH_SUCCESS,
          expect.any(Object),
          expect.objectContaining({
            userId: mockUserId
          })
        );
      });

      it('should log TOKEN_REFRESH_FAILURE on expired token', async () => {
        const refreshToken = jwt.sign(
          { userId: mockUserId, type: 'refresh' },
          JWT_SECRET,
          { expiresIn: '-1s' }
        );

        await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken });

        expect(logSecurityEvent).toHaveBeenCalledWith(
          SECURITY_EVENTS.TOKEN_REFRESH_FAILURE,
          expect.any(Object),
          expect.objectContaining({
            reason: 'token_expired'
          })
        );
      });

      it('should log TOKEN_REFRESH_FAILURE on invalid token type', async () => {
        const accessToken = jwt.sign(
          { userId: mockUserId, type: 'access' },
          JWT_SECRET,
          { expiresIn: '15m' }
        );

        await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: accessToken });

        expect(logSecurityEvent).toHaveBeenCalledWith(
          SECURITY_EVENTS.TOKEN_REFRESH_FAILURE,
          expect.any(Object),
          expect.objectContaining({
            reason: 'invalid_token_type'
          })
        );
      });
    });

    describe('Logout events', () => {
      it('should log LOGOUT event', async () => {
        await request(app)
          .post('/api/v1/auth/logout');

        expect(logSecurityEvent).toHaveBeenCalledWith(
          SECURITY_EVENTS.LOGOUT,
          expect.any(Object),
          expect.any(Object)
        );
      });
    });
  });
});
