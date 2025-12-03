const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { loginLimiter, registerLimiter, refreshLimiter } = require('../middleware/rateLimiter');
const { sanitizeBody, sanitizeEmail } = require('../middleware/sanitize');
const { logSecurityEvent, SECURITY_EVENTS } = require('../utils/securityLogger');
const tokenService = require('../services/tokenService');
const {
  JWT_SECRET,
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  IS_PRODUCTION
} = require('../config/jwt');

const router = express.Router();

// Cookie options
const cookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION, // Only send over HTTPS in production
  sameSite: IS_PRODUCTION ? 'strict' : 'lax',
  path: '/'
};

// Set auth cookies on response
function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE
  });
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE
  });
}

// Generate tokens with unique jti claims
function generateTokens(userId) {
  const accessToken = jwt.sign(
    { userId, type: 'access', jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
  const refreshToken = jwt.sign(
    { userId, type: 'refresh', jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
  return { accessToken, refreshToken };
}

// Validation middleware
const registerValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').notEmpty().withMessage('Name is required')
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Clear auth cookies on response
function clearAuthCookies(res) {
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
}

// POST /api/v1/auth/register
router.post('/register', registerLimiter, sanitizeBody, sanitizeEmail, registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at AS "createdAt"`,
      [email, hashedPassword, name]
    );

    const user = result.rows[0];
    const tokens = generateTokens(user.id);

    // Store refresh token in database for rotation/revocation
    const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);
    await tokenService.storeRefreshToken(user.id, tokens.refreshToken, refreshTokenExpiry);

    // Set HttpOnly cookies
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    logSecurityEvent(SECURITY_EVENTS.REGISTER_SUCCESS, req, {
      email: user.email,
      userId: user.id
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/login
router.post('/login', loginLimiter, sanitizeBody, sanitizeEmail, loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT id, email, name, password_hash, created_at AS "createdAt" FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILURE, req, {
        email,
        reason: 'user_not_found'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILURE, req, {
        email,
        reason: 'invalid_password'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokens = generateTokens(user.id);

    // Store refresh token in database for rotation/revocation
    const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);
    await tokenService.storeRefreshToken(user.id, tokens.refreshToken, refreshTokenExpiry);

    // Set HttpOnly cookies
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, req, {
      email: user.email,
      userId: user.id
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    // Read refresh token from cookie (with body fallback for backwards compatibility)
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    if (decoded.type !== 'refresh') {
      logSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH_FAILURE, req, {
        reason: 'invalid_token_type'
      });
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Validate token in database (check if revoked or not found)
    const tokenValidation = await tokenService.validateRefreshToken(refreshToken);
    if (!tokenValidation.valid) {
      logSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH_FAILURE, req, {
        reason: tokenValidation.reason
      });
      if (tokenValidation.reason === 'token_revoked') {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Revoke the old refresh token
    await tokenService.revokeRefreshToken(refreshToken);

    // Generate new tokens (rotation)
    const tokens = generateTokens(decoded.userId);

    // Store new refresh token in database
    const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);
    await tokenService.storeRefreshToken(decoded.userId, tokens.refreshToken, refreshTokenExpiry);

    // Set new cookies
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    logSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH_SUCCESS, req, {
      userId: decoded.userId
    });

    res.json({ accessToken: tokens.accessToken });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH_FAILURE, req, {
        reason: 'token_expired'
      });
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      logSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH_FAILURE, req, {
        reason: 'invalid_token'
      });
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req, res) => {
  // Revoke the refresh token if present
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    await tokenService.revokeRefreshToken(refreshToken);
  }

  clearAuthCookies(res);
  logSecurityEvent(SECURITY_EVENTS.LOGOUT, req, {});
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
