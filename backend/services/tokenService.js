const crypto = require('crypto');
const pool = require('../db/pool');

/**
 * Hash a token using SHA256
 * @param {string} token - The plain text token
 * @returns {string} The SHA256 hash of the token
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Store a refresh token hash in the database
 * @param {string} userId - The user ID
 * @param {string} refreshToken - The plain text refresh token
 * @param {Date} expiresAt - When the token expires
 * @returns {Promise<void>}
 */
async function storeRefreshToken(userId, refreshToken, expiresAt) {
  const tokenHash = hashToken(refreshToken);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

/**
 * Validate a refresh token
 * @param {string} refreshToken - The plain text refresh token
 * @returns {Promise<{valid: boolean, userId?: string, tokenId?: string, reason?: string}>}
 */
async function validateRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);

  const result = await pool.query(
    `SELECT id, user_id, revoked, expires_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return { valid: false, reason: 'token_not_found' };
  }

  const tokenRecord = result.rows[0];

  if (tokenRecord.revoked) {
    return { valid: false, reason: 'token_revoked' };
  }

  return {
    valid: true,
    userId: tokenRecord.user_id,
    tokenId: tokenRecord.id
  };
}

/**
 * Revoke a specific refresh token
 * @param {string} refreshToken - The plain text refresh token
 * @returns {Promise<void>}
 */
async function revokeRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);

  await pool.query(
    `UPDATE refresh_tokens
     SET revoked = TRUE
     WHERE token_hash = $1`,
    [tokenHash]
  );
}

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - The user ID
 * @returns {Promise<number>} Number of tokens revoked
 */
async function revokeAllUserTokens(userId) {
  const result = await pool.query(
    `UPDATE refresh_tokens
     SET revoked = TRUE
     WHERE user_id = $1 AND revoked = FALSE`,
    [userId]
  );

  return result.rowCount;
}

/**
 * Clean up expired tokens from the database
 * @returns {Promise<number>} Number of tokens deleted
 */
async function cleanupExpiredTokens() {
  const result = await pool.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < $1`,
    [new Date()]
  );

  return result.rowCount;
}

module.exports = {
  hashToken,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens
};
