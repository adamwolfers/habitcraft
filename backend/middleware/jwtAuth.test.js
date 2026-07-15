const jwt = require('jsonwebtoken');
const { jwtAuthMiddleware } = require('./jwtAuth');
const { logSecurityEvent, SECURITY_EVENTS } = require('../utils/securityLogger');

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

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('JWT Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      headers: {},
      cookies: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFn = jest.fn();
  });

  it('should call next() with valid access token from Authorization header', () => {
    const token = jwt.sign({ userId: 'user-123', type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
    mockReq.headers.authorization = `Bearer ${token}`;

    jwtAuthMiddleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.userId).toBe('user-123');
  });

  it('should call next() with valid access token from cookie', () => {
    const token = jwt.sign({ userId: 'user-456', type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
    mockReq.cookies.accessToken = token;

    jwtAuthMiddleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.userId).toBe('user-456');
  });

  it('should prefer cookie over Authorization header', () => {
    const cookieToken = jwt.sign({ userId: 'cookie-user', type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
    const headerToken = jwt.sign({ userId: 'header-user', type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

    mockReq.cookies.accessToken = cookieToken;
    mockReq.headers.authorization = `Bearer ${headerToken}`;

    jwtAuthMiddleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.userId).toBe('cookie-user');
  });

  it('should return 401 if no authorization header', () => {
    jwtAuthMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should return 401 if authorization header is malformed', () => {
    mockReq.headers.authorization = 'InvalidFormat';

    jwtAuthMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token format' });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', () => {
    mockReq.headers.authorization = 'Bearer invalid-token';

    jwtAuthMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should return 401 if token is expired', () => {
    const token = jwt.sign({ userId: 'user-123', type: 'access' }, JWT_SECRET, { expiresIn: '-1s' });
    mockReq.headers.authorization = `Bearer ${token}`;

    jwtAuthMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should return 401 if token type is not access', () => {
    const token = jwt.sign({ userId: 'user-123', type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
    mockReq.headers.authorization = `Bearer ${token}`;

    jwtAuthMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token type' });
    expect(nextFn).not.toHaveBeenCalled();
  });

  describe('Security Event Logging', () => {
    beforeEach(() => {
      logSecurityEvent.mockClear();
    });

    it('should log AUTH_FAILURE when no token provided', () => {
      mockReq.path = '/api/v1/habits';

      jwtAuthMiddleware(mockReq, mockRes, nextFn);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        SECURITY_EVENTS.AUTH_FAILURE,
        expect.any(Object),
        expect.objectContaining({
          reason: 'no_token'
        })
      );
    });

    it('should log AUTH_FAILURE when token format is invalid', () => {
      mockReq.headers.authorization = 'InvalidFormat';
      mockReq.path = '/api/v1/habits';

      jwtAuthMiddleware(mockReq, mockRes, nextFn);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        SECURITY_EVENTS.AUTH_FAILURE,
        expect.any(Object),
        expect.objectContaining({
          reason: 'invalid_format'
        })
      );
    });

    it('should log AUTH_FAILURE when token is invalid', () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      mockReq.path = '/api/v1/habits';

      jwtAuthMiddleware(mockReq, mockRes, nextFn);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        SECURITY_EVENTS.AUTH_FAILURE,
        expect.any(Object),
        expect.objectContaining({
          reason: 'invalid_token'
        })
      );
    });

    it('should log AUTH_FAILURE when token is expired', () => {
      const token = jwt.sign({ userId: 'user-123', type: 'access' }, JWT_SECRET, { expiresIn: '-1s' });
      mockReq.headers.authorization = `Bearer ${token}`;
      mockReq.path = '/api/v1/habits';

      jwtAuthMiddleware(mockReq, mockRes, nextFn);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        SECURITY_EVENTS.AUTH_FAILURE,
        expect.any(Object),
        expect.objectContaining({
          reason: 'token_expired'
        })
      );
    });

    it('should log AUTH_FAILURE when token type is wrong', () => {
      const token = jwt.sign({ userId: 'user-123', type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
      mockReq.headers.authorization = `Bearer ${token}`;
      mockReq.path = '/api/v1/habits';

      jwtAuthMiddleware(mockReq, mockRes, nextFn);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        SECURITY_EVENTS.AUTH_FAILURE,
        expect.any(Object),
        expect.objectContaining({
          reason: 'invalid_token_type'
        })
      );
    });

    it('should NOT log when authentication succeeds', () => {
      const token = jwt.sign({ userId: 'user-123', type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      mockReq.headers.authorization = `Bearer ${token}`;

      jwtAuthMiddleware(mockReq, mockRes, nextFn);

      expect(logSecurityEvent).not.toHaveBeenCalled();
    });
  });
});
