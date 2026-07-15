/**
 * JWT Configuration
 *
 * Centralizes JWT settings and enforces secure configuration in production.
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Validates and returns the JWT secret.
 * In production, enforces security requirements.
 * In development/test, allows fallback for convenience.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (IS_PRODUCTION) {
    if (!secret) {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is required in production. ' +
        'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
    }

    if (secret.length < 32) {
      throw new Error(
        'FATAL: JWT_SECRET must be at least 32 characters in production for security.'
      );
    }

    if (secret.includes('dev') || secret.includes('change') || secret.includes('secret-key')) {
      throw new Error(
        'FATAL: JWT_SECRET appears to be a development placeholder. Use a secure random secret in production.'
      );
    }
  }

  // In development/test, allow fallback for convenience
  return secret || 'dev-secret-change-in-production';
}

// Initialize and validate on module load
const JWT_SECRET = getJwtSecret();

module.exports = {
  JWT_SECRET,
  ACCESS_TOKEN_EXPIRES: '15m',
  REFRESH_TOKEN_EXPIRES: '7d',
  ACCESS_TOKEN_MAX_AGE: 15 * 60 * 1000,           // 15 minutes in ms
  REFRESH_TOKEN_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  IS_PRODUCTION,
  IS_TEST
};
