const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const tokenService = require('../services/tokenService');
const { logSecurityEvent, SECURITY_EVENTS } = require('../utils/securityLogger');

// Mock the database pool
jest.mock('../db/pool');
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

    it('should return 400 when no fields are provided', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('At least one field (name or email) is required');
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

  describe('PUT /api/v1/users/me - Email Update', () => {
    it('should update user email with valid token', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const updatedUser = {
        id: mockUserId,
        email: 'newemail@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString()
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

    it('should return 400 for invalid email format', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Invalid email format');
    });

    it('should return 400 for empty email', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: '' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 409 when email is already taken by another user', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      // Mock check for existing email - found another user with this email
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 'different-user-id', email: 'taken@example.com' }]
      });

      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'taken@example.com' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email is already in use');
    });

    it('should allow updating to the same email (no change)', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const updatedUser = {
        id: mockUserId,
        email: 'current@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString()
      };

      // Mock check for existing email - finds current user (same id)
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockUserId, email: 'current@example.com' }]
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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const updatedUser = {
        id: mockUserId,
        email: 'newemail@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString()
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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const updatedUser = {
        id: mockUserId,
        email: 'trimmed@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString()
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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const updatedUser = {
        id: mockUserId,
        email: 'newemail@example.com',
        name: 'New Name',
        createdAt: new Date().toISOString()
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
      confirmPassword: 'NewSecure456!'
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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          newPassword: 'NewSecure456!',
          confirmPassword: 'NewSecure456!'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].path).toBe('currentPassword');
    });

    it('should return 400 for missing newPassword', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPass123!',
          confirmPassword: 'NewSecure456!'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].path).toBe('newPassword');
    });

    it('should return 400 for newPassword too short', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPass123!',
          newPassword: 'short',
          confirmPassword: 'short'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('8 characters');
    });

    it('should return 400 when passwords do not match', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPass123!',
          newPassword: 'NewSecure456!',
          confirmPassword: 'DifferentPass789!'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('match');
    });

    it('should return 404 if user not found', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPasswordChange);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 401 for wrong current password', async () => {
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        password_hash: 'hashed_password'
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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        password_hash: 'old_hashed_password'
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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        password_hash: 'old_hashed_password'
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
      const accessToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        password_hash: 'old_hashed_password'
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
});
