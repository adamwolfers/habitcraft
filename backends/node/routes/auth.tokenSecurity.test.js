const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock the token service BEFORE requiring app
jest.mock('../services/tokenService', () => ({
  storeRefreshToken: jest.fn().mockResolvedValue(),
  validateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn().mockResolvedValue(),
  revokeAllUserTokens: jest.fn().mockResolvedValue(1),
  hashToken: jest.fn(token => `hashed_${token}`)
}));

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

const app = require('../app');
const pool = require('../db/pool');
const tokenService = require('../services/tokenService');

describe('Auth API - Token Security Enhancements', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Refresh token storage', () => {
    it('should store refresh token on login', async () => {
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

      expect(tokenService.storeRefreshToken).toHaveBeenCalledWith(
        mockUserId,
        expect.any(String),
        expect.any(Date)
      );
    });

    it('should store refresh token on register', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'newuser@example.com',
        name: 'New User',
        created_at: new Date().toISOString()
      };

      pool.query.mockResolvedValueOnce({ rows: [] }); // Check user doesn't exist
      pool.query.mockResolvedValueOnce({ rows: [mockUser] }); // Insert user

      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'New User'
        });

      expect(tokenService.storeRefreshToken).toHaveBeenCalledWith(
        mockUserId,
        expect.any(String),
        expect.any(Date)
      );
    });
  });

  describe('Refresh token rotation', () => {
    it('should validate token in database before refreshing', async () => {
      const refreshToken = jwt.sign(
        { userId: mockUserId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      tokenService.validateRefreshToken.mockResolvedValueOnce({
        valid: true,
        userId: mockUserId,
        tokenId: 'token-id'
      });

      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(tokenService.validateRefreshToken).toHaveBeenCalledWith(refreshToken);
    });

    it('should revoke old token and store new one on refresh', async () => {
      const refreshToken = jwt.sign(
        { userId: mockUserId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      tokenService.validateRefreshToken.mockResolvedValueOnce({
        valid: true,
        userId: mockUserId,
        tokenId: 'token-id'
      });

      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(tokenService.storeRefreshToken).toHaveBeenCalledWith(
        mockUserId,
        expect.any(String),
        expect.any(Date)
      );
    });

    it('should return new refresh token in cookie on refresh', async () => {
      const refreshToken = jwt.sign(
        { userId: mockUserId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      tokenService.validateRefreshToken.mockResolvedValueOnce({
        valid: true,
        userId: mockUserId,
        tokenId: 'token-id'
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      const cookies = response.headers['set-cookie'];
      expect(cookies.some(c => c.startsWith('refreshToken=') && c.includes('HttpOnly'))).toBe(true);
    });

    it('should reject revoked tokens', async () => {
      const refreshToken = jwt.sign(
        { userId: mockUserId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      tokenService.validateRefreshToken.mockResolvedValueOnce({
        valid: false,
        reason: 'token_revoked'
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('revoked');
    });

    it('should reject tokens not in database', async () => {
      const refreshToken = jwt.sign(
        { userId: mockUserId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      tokenService.validateRefreshToken.mockResolvedValueOnce({
        valid: false,
        reason: 'token_not_found'
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('Token revocation on logout', () => {
    it('should revoke refresh token on logout', async () => {
      const refreshToken = jwt.sign(
        { userId: mockUserId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith(refreshToken);
    });
  });

  describe('Token uniqueness (jti claim)', () => {
    it('should generate tokens with unique jti claims', async () => {
      const hashedPassword = await bcrypt.hash('SecurePass123!', 10);
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        password_hash: hashedPassword,
        created_at: new Date().toISOString()
      };

      // Login twice in quick succession
      pool.query.mockResolvedValue({ rows: [mockUser] });

      const response1 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });

      const response2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });

      // Extract refresh tokens from cookies
      const getRefreshToken = (res) => {
        const cookies = res.headers['set-cookie'];
        const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
        const match = refreshCookie.match(/refreshToken=([^;]+)/);
        return match[1];
      };

      const token1 = getRefreshToken(response1);
      const token2 = getRefreshToken(response2);

      // Tokens should be different
      expect(token1).not.toBe(token2);

      // Both tokens should have jti claims
      const decoded1 = jwt.decode(token1);
      const decoded2 = jwt.decode(token2);

      expect(decoded1.jti).toBeDefined();
      expect(decoded2.jti).toBeDefined();
      expect(decoded1.jti).not.toBe(decoded2.jti);
    });

    it('should include jti in access tokens', async () => {
      const hashedPassword = await bcrypt.hash('SecurePass123!', 10);
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        password_hash: hashedPassword,
        created_at: new Date().toISOString()
      };

      pool.query.mockResolvedValue({ rows: [mockUser] });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });

      const cookies = response.headers['set-cookie'];
      const accessCookie = cookies.find(c => c.startsWith('accessToken='));
      const match = accessCookie.match(/accessToken=([^;]+)/);
      const accessToken = match[1];

      const decoded = jwt.decode(accessToken);
      expect(decoded.jti).toBeDefined();
      expect(typeof decoded.jti).toBe('string');
      expect(decoded.jti.length).toBeGreaterThan(0);
    });
  });
});
