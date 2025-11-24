const jwt = require('jsonwebtoken');
const { jwtAuthMiddleware } = require('./jwtAuth');

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
});
