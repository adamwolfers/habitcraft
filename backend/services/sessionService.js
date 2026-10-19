const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const tokenService = require('./tokenService');
const {
  JWT_SECRET,
  JWT_ALGORITHM,
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  IS_PRODUCTION,
} = require('../config/jwt');

// Cookie options
const cookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION, // Only send over HTTPS in production
  sameSite: IS_PRODUCTION ? 'strict' : 'lax',
  path: '/',
};

// Generate tokens with unique jti claims
function generateTokens(userId) {
  const accessToken = jwt.sign({ userId, type: 'access', jti: crypto.randomUUID() }, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
  const refreshToken = jwt.sign({ userId, type: 'refresh', jti: crypto.randomUUID() }, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
  return { accessToken, refreshToken };
}

// Set auth cookies on response
function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

// Clear auth cookies on response
function clearAuthCookies(res) {
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
}

/**
 * Start a session for a user: generate a token pair, store the refresh
 * token's hash for rotation/revocation, and set both as HttpOnly cookies.
 * Returns the pair so the caller can also put it in the body for mobile
 * clients, which have no cookie jar.
 */
async function issueSession(res, userId) {
  const tokens = generateTokens(userId);
  const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);
  await tokenService.storeRefreshToken(userId, tokens.refreshToken, refreshTokenExpiry);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  return tokens;
}

module.exports = {
  issueSession,
  clearAuthCookies,
};
