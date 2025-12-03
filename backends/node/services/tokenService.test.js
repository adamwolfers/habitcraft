const crypto = require('crypto');
const pool = require('../db/pool');
const tokenService = require('./tokenService');

// Mock the database pool
jest.mock('../db/pool');

describe('TokenService', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockRefreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-refresh-token';
  const mockTokenHash = crypto.createHash('sha256').update(mockRefreshToken).digest('hex');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storeRefreshToken', () => {
    it('should store a hashed refresh token in the database', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'token-id' }] });

      await tokenService.storeRefreshToken(mockUserId, mockRefreshToken, expiresAt);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        expect.arrayContaining([mockUserId, mockTokenHash, expect.any(Date)])
      );
    });

    it('should store the token hash, not the plain token', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'token-id' }] });

      await tokenService.storeRefreshToken(mockUserId, mockRefreshToken, expiresAt);

      const callArgs = pool.query.mock.calls[0][1];
      const storedValue = callArgs[1]; // token_hash is second parameter
      expect(storedValue).toBe(mockTokenHash);
      expect(storedValue).not.toBe(mockRefreshToken);
    });
  });

  describe('validateRefreshToken', () => {
    it('should return true for a valid, non-revoked token', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 'token-id',
          user_id: mockUserId,
          revoked: false,
          expires_at: new Date(Date.now() + 1000000)
        }]
      });

      const result = await tokenService.validateRefreshToken(mockRefreshToken);

      expect(result).toEqual({
        valid: true,
        userId: mockUserId,
        tokenId: 'token-id'
      });
    });

    it('should return false for a revoked token', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 'token-id',
          user_id: mockUserId,
          revoked: true,
          expires_at: new Date(Date.now() + 1000000)
        }]
      });

      const result = await tokenService.validateRefreshToken(mockRefreshToken);

      expect(result).toEqual({
        valid: false,
        reason: 'token_revoked'
      });
    });

    it('should return false for a token not in the database', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await tokenService.validateRefreshToken(mockRefreshToken);

      expect(result).toEqual({
        valid: false,
        reason: 'token_not_found'
      });
    });

    it('should query using the token hash', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await tokenService.validateRefreshToken(mockRefreshToken);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('token_hash'),
        [mockTokenHash]
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('should mark a token as revoked', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      await tokenService.revokeRefreshToken(mockRefreshToken);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens'),
        expect.arrayContaining([mockTokenHash])
      );
    });

    it('should use the token hash for the update', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      await tokenService.revokeRefreshToken(mockRefreshToken);

      const callArgs = pool.query.mock.calls[0][1];
      expect(callArgs).toContain(mockTokenHash);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 3 });

      const count = await tokenService.revokeAllUserTokens(mockUserId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens'),
        [mockUserId]
      );
      expect(count).toBe(3);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 5 });

      const count = await tokenService.cleanupExpiredTokens();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        expect.any(Array)
      );
      expect(count).toBe(5);
    });
  });

  describe('hashToken', () => {
    it('should consistently hash the same token', () => {
      const hash1 = tokenService.hashToken(mockRefreshToken);
      const hash2 = tokenService.hashToken(mockRefreshToken);

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(mockTokenHash);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = tokenService.hashToken('token1');
      const hash2 = tokenService.hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });
  });
});
