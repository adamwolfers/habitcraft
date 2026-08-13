const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const tokenService = require('../services/tokenService');
const { logSecurityEvent, SECURITY_EVENTS } = require('../utils/securityLogger');

// Mock the database pool.
//
// The factory mirrors the REAL module surface and seals it, deliberately. This
// file previously did `pool.connect = jest.fn()`, inventing a method db/pool has
// never exported; every delete-account test below then passed against an API
// that did not exist at runtime, while DELETE /api/v1/users/me 500'd in
// production for seven months (habitcraft-3h9). Sealing means a mock can no
// longer grow a method the real module lacks. Take transaction clients through
// getPool(), as the route does.
jest.mock('../db/pool', () => {
  const actual = jest.requireActual('../db/pool');
  const mocked = {};
  for (const key of Object.keys(actual)) {
    mocked[key] = jest.fn();
  }
  return Object.seal(mocked);
});
jest.mock('bcrypt');
jest.mock('../services/tokenService');
jest.mock('../utils/securityLogger');

describe('Users API', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/users/me', () => {
    it('should return user profile with valid token', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/v1/users/me');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should return 404 if user not found', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const updatedUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Updated Name',
        createdAt: new Date().toISOString(),
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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Name is required');
    });

    it('should return 400 for whitespace-only name', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Name is required');
    });

    it('should return 400 when no fields are provided', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('At least one field (name or email) is required');
    });

    it('should return 400 for name exceeding max length', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const updatedUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Trimmed Name',
        createdAt: new Date().toISOString(),
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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return all expected user fields', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const updatedUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Updated Name',
        createdAt: '2025-01-15T10:30:00.000Z',
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
        createdAt: '2025-01-15T10:30:00.000Z',
      });
    });
  });

  describe('PUT /api/v1/users/me - Email Update', () => {
    it('should update user email with valid token', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const updatedUser = {
        id: mockUserId,
        email: 'newemail@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
      };

      // Mock check for existing email (none found)
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Mock update query
      pool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'newemail@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('newemail@example.com');
    });

    it('should return 400 for email exceeding 255 characters', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const longEmail = 'a'.repeat(64) + '@' + 'b'.repeat(186) + '.com'; // 256 chars

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: longEmail });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      // May fail on isEmail or isLength, either is acceptable
      const errorMsgs = response.body.errors.map((e) => e.msg);
      const hasLengthOrFormatError = errorMsgs.some(
        (msg) => msg.includes('255') || msg.includes('email') || msg.includes('Email')
      );
      expect(hasLengthOrFormatError).toBe(true);
    });

    it('should return 400 for invalid email format', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Invalid email format');
    });

    it('should return 400 for empty email', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: '' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 409 when email is already taken by another user', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      // Mock check for existing email - found another user with this email
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 'different-user-id', email: 'taken@example.com' }],
      });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'taken@example.com' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email is already in use');
    });

    it('should allow updating to the same email (no change)', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const updatedUser = {
        id: mockUserId,
        email: 'current@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
      };

      // Mock check for existing email - finds current user (same id)
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockUserId, email: 'current@example.com' }],
      });
      // Mock update query
      pool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'current@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('current@example.com');
    });

    it('should normalize email to lowercase', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const updatedUser = {
        id: mockUserId,
        email: 'newemail@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
      };

      // Mock check for existing email (none found)
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Mock update query
      pool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'NewEmail@Example.COM' });

      expect(response.status).toBe(200);
      // Check that the query was called with lowercase email
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['newemail@example.com'])
      );
    });

    it('should trim whitespace from email', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const updatedUser = {
        id: mockUserId,
        email: 'trimmed@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
      };

      // Mock check for existing email (none found)
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Mock update query
      pool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: '  trimmed@example.com  ' });

      expect(response.status).toBe(200);
    });

    it('should update both name and email together', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const updatedUser = {
        id: mockUserId,
        email: 'newemail@example.com',
        name: 'New Name',
        createdAt: new Date().toISOString(),
      };

      // Mock check for existing email (none found)
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Mock update query
      pool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'New Name', email: 'newemail@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name');
      expect(response.body.email).toBe('newemail@example.com');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .put('/api/v1/users/me')
        .send({ email: 'newemail@example.com' });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/users/me/password', () => {
    const validPasswordChange = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewSecure456!',
      confirmPassword: 'NewSecure456!',
    };

    beforeEach(() => {
      // Reset mocks
      bcrypt.compare.mockReset();
      bcrypt.hash.mockReset();
      tokenService.revokeAllUserTokens.mockReset();
      logSecurityEvent.mockReset();
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .put('/api/v1/users/me/password')
        .send(validPasswordChange);

      expect(response.status).toBe(401);
    });

    it('should return 400 for missing currentPassword', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          newPassword: 'NewSecure456!',
          confirmPassword: 'NewSecure456!',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].path).toBe('currentPassword');
    });

    it('should return 400 for missing newPassword', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPass123!',
          confirmPassword: 'NewSecure456!',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].path).toBe('newPassword');
    });

    it('should return 400 for newPassword too short', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPass123!',
          newPassword: 'short',
          confirmPassword: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('8 characters');
    });

    it('should return 400 for newPassword exceeding 72 characters', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const longPassword = 'a'.repeat(73);

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPass123!',
          newPassword: longPassword,
          confirmPassword: longPassword,
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('72');
    });

    it('should return 400 when passwords do not match', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPass123!',
          newPassword: 'NewSecure456!',
          confirmPassword: 'DifferentPass789!',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('match');
    });

    it('should return 404 if user not found', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPasswordChange);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 401 for wrong current password', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        password_hash: 'hashed_password',
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValueOnce(false);

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPasswordChange);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid current password');
      expect(logSecurityEvent).toHaveBeenCalledWith(
        SECURITY_EVENTS.PASSWORD_CHANGE_FAILURE,
        expect.any(Object),
        expect.objectContaining({ userId: mockUserId, reason: 'invalid_password' })
      );
    });

    it('should change password successfully with valid data', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        password_hash: 'old_hashed_password',
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValueOnce(true);
      bcrypt.hash.mockResolvedValueOnce('new_hashed_password');
      pool.query.mockResolvedValueOnce({ rows: [{ id: mockUserId }] });
      tokenService.revokeAllUserTokens.mockResolvedValueOnce();

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPasswordChange);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password changed successfully');
      expect(bcrypt.hash).toHaveBeenCalledWith('NewSecure456!', 10);
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(mockUserId);
      expect(logSecurityEvent).toHaveBeenCalledWith(
        SECURITY_EVENTS.PASSWORD_CHANGE_SUCCESS,
        expect.any(Object),
        expect.objectContaining({ userId: mockUserId })
      );
    });

    it('should update password_hash in database', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        password_hash: 'old_hashed_password',
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValueOnce(true);
      bcrypt.hash.mockResolvedValueOnce('new_hashed_password');
      pool.query.mockResolvedValueOnce({ rows: [{ id: mockUserId }] });
      tokenService.revokeAllUserTokens.mockResolvedValueOnce();

      await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPasswordChange);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['new_hashed_password', mockUserId])
      );
    });

    it('should revoke all refresh tokens after password change', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        password_hash: 'old_hashed_password',
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValueOnce(true);
      bcrypt.hash.mockResolvedValueOnce('new_hashed_password');
      pool.query.mockResolvedValueOnce({ rows: [{ id: mockUserId }] });
      tokenService.revokeAllUserTokens.mockResolvedValueOnce();

      await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPasswordChange);

      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('DELETE /api/v1/users/me', () => {
    let mockClient;
    let mockConnect;

    beforeEach(() => {
      // Create mock client for transaction
      mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      // The transaction client comes from the pg Pool that getPool() returns --
      // db/pool itself has no .connect(). See the jest.mock note above.
      mockConnect = jest.fn().mockResolvedValue(mockClient);
      pool.getPool.mockReturnValue({ connect: mockConnect });
      bcrypt.compare.mockReset();
      logSecurityEvent.mockReset();
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .delete('/api/v1/users/me')
        .send({ password: 'TestPass123!' });

      expect(response.status).toBe(401);
    });

    it('should return 400 if password not provided', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password confirmation required');
    });

    it('should return 404 if user not found', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT user - not found

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'TestPass123!' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return 401 if password is incorrect', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ email: 'test@example.com', password_hash: 'hashed' }] }); // SELECT user

      bcrypt.compare.mockResolvedValueOnce(false); // Password doesn't match

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'WrongPassword!' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid password');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should delete user and all related data successfully', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ email: 'test@example.com', password_hash: 'hashed' }] }) // SELECT user
        .mockResolvedValueOnce({}) // DELETE completions
        .mockResolvedValueOnce({}) // DELETE habits
        .mockResolvedValueOnce({}) // DELETE refresh_tokens
        .mockResolvedValueOnce({}) // DELETE user
        .mockResolvedValueOnce({}); // COMMIT

      bcrypt.compare.mockResolvedValueOnce(true); // Password matches

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'TestPass123!' });

      expect(response.status).toBe(204);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should delete data in correct foreign key order', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ email: 'test@example.com', password_hash: 'hashed' }] }) // SELECT user
        .mockResolvedValueOnce({}) // DELETE completions
        .mockResolvedValueOnce({}) // DELETE habits
        .mockResolvedValueOnce({}) // DELETE refresh_tokens
        .mockResolvedValueOnce({}) // DELETE user
        .mockResolvedValueOnce({}); // COMMIT

      bcrypt.compare.mockResolvedValueOnce(true);

      await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'TestPass123!' });

      const calls = mockClient.query.mock.calls;
      // Find the order of DELETE calls
      const deleteCompletionsIndex = calls.findIndex(
        (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM completions')
      );
      const deleteHabitsIndex = calls.findIndex(
        (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM habits')
      );
      const deleteRefreshTokensIndex = calls.findIndex(
        (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM refresh_tokens')
      );
      const deleteUserIndex = calls.findIndex(
        (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM users')
      );

      // Completions must be deleted before habits (FK constraint)
      expect(deleteCompletionsIndex).toBeLessThan(deleteHabitsIndex);
      // Habits and refresh_tokens before user
      expect(deleteHabitsIndex).toBeLessThan(deleteUserIndex);
      expect(deleteRefreshTokensIndex).toBeLessThan(deleteUserIndex);
    });

    it('should log ACCOUNT_DELETED security event on success', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ email: 'deleted@example.com', password_hash: 'hashed' }],
        }) // SELECT user
        .mockResolvedValueOnce({}) // DELETE completions
        .mockResolvedValueOnce({}) // DELETE habits
        .mockResolvedValueOnce({}) // DELETE refresh_tokens
        .mockResolvedValueOnce({}) // DELETE user
        .mockResolvedValueOnce({}); // COMMIT

      bcrypt.compare.mockResolvedValueOnce(true);

      await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'TestPass123!' });

      expect(logSecurityEvent).toHaveBeenCalledWith(
        SECURITY_EVENTS.ACCOUNT_DELETED,
        expect.any(Object),
        expect.objectContaining({
          userId: mockUserId,
          email: 'deleted@example.com',
        })
      );
    });

    it('should rollback transaction on database error', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ email: 'test@example.com', password_hash: 'hashed' }] }) // SELECT user
        .mockRejectedValueOnce(new Error('Database error')); // DELETE completions fails

      bcrypt.compare.mockResolvedValueOnce(true);

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'TestPass123!' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should take the transaction client from getPool(), not the module', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ email: 'test@example.com', password_hash: 'hashed' }] }) // SELECT user
        .mockResolvedValue({}); // DELETEs + COMMIT

      bcrypt.compare.mockResolvedValueOnce(true);

      await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'TestPass123!' });

      expect(pool.getPool).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
      // Guards habitcraft-3h9: db/pool must never be expected to expose connect.
      expect(pool.connect).toBeUndefined();
    });

    it('should return 500 if a client cannot be acquired', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      mockConnect.mockRejectedValueOnce(new Error('pool exhausted'));

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'TestPass123!' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
      // Nothing was acquired, so nothing must be released.
      expect(mockClient.release).not.toHaveBeenCalled();
    });

    it('should still respond 500 and release the client if ROLLBACK also fails', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ email: 'test@example.com', password_hash: 'hashed' }] }) // SELECT user
        .mockRejectedValueOnce(new Error('Database error')) // DELETE completions fails
        .mockRejectedValueOnce(new Error('Connection terminated')); // ROLLBACK fails too

      bcrypt.compare.mockResolvedValueOnce(true);

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'TestPass123!' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
