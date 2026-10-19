const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { loginLimiter, registerLimiter, refreshLimiter } = require('../middleware/rateLimiter');
const { sanitizeBody, sanitizeEmail } = require('../middleware/sanitize');
const { logSecurityEvent, SECURITY_EVENTS } = require('../utils/securityLogger');
const tokenService = require('../services/tokenService');
const { issueSession, clearAuthCookies } = require('../services/sessionService');
const { requestLimits } = require('../validators/apiLimits.generated');
const { JWT_SECRET, JWT_ALGORITHMS } = require('../config/jwt');

const router = express.Router();

// Validation middleware.
//
// Every length below comes from the spec via apiLimits.generated.js, messages
// included -- a number written into the message text is a restatement that
// drifts just as readily as the check itself (habitcraft-34d.3).
const REGISTER_LIMITS = requestLimits.register;

const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .isLength({ max: REGISTER_LIMITS.email.maxLength })
    .withMessage(`Email must be ${REGISTER_LIMITS.email.maxLength} characters or less`),
  body('password')
    .isLength({ min: REGISTER_LIMITS.password.minLength })
    .withMessage(`Password must be at least ${REGISTER_LIMITS.password.minLength} characters`)
    .isLength({ max: REGISTER_LIMITS.password.maxLength })
    .withMessage(`Password must be ${REGISTER_LIMITS.password.maxLength} characters or less`),
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: REGISTER_LIMITS.name.maxLength })
    .withMessage(`Name must be ${REGISTER_LIMITS.name.maxLength} characters or less`),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// POST /api/v1/auth/register
router.post(
  '/register',
  registerLimiter,
  sanitizeBody,
  sanitizeEmail,
  registerValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name } = req.body;

      // Check if user already exists
      const existingUser = await pool.query('SELECT id, email FROM users WHERE email = $1', [
        email,
      ]);

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
      const tokens = await issueSession(res, user.id);

      logSecurityEvent(SECURITY_EVENTS.REGISTER_SUCCESS, req, {
        email: user.email,
        userId: user.id,
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
        // Include tokens in body for mobile clients (web uses HttpOnly cookies)
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/v1/auth/login
router.post(
  '/login',
  loginLimiter,
  sanitizeBody,
  sanitizeEmail,
  loginValidation,
  async (req, res) => {
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
          reason: 'user_not_found',
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILURE, req, {
          email,
          reason: 'invalid_password',
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const tokens = await issueSession(res, user.id);

      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, req, {
        email: user.email,
        userId: user.id,
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
        // Include tokens in body for mobile clients (web uses HttpOnly cookies)
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      console.error('Error logging in:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/v1/auth/refresh
router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    // Read refresh token from cookie (with body fallback for backwards compatibility)
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET, { algorithms: JWT_ALGORITHMS });

    if (decoded.type !== 'refresh') {
      logSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH_FAILURE, req, {
        reason: 'invalid_token_type',
      });
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Validate token in database (check if revoked or not found)
    const tokenValidation = await tokenService.validateRefreshToken(refreshToken);
    if (!tokenValidation.valid) {
      logSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH_FAILURE, req, {
        reason: tokenValidation.reason,
      });
      if (tokenValidation.reason === 'token_revoked') {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Revoke the old refresh token
    await tokenService.revokeRefreshToken(refreshToken);

    // Issue a new pair (rotation)
    const tokens = await issueSession(res, decoded.userId);

    logSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH_SUCCESS, req, {
      userId: decoded.userId,
    });

    res.json({
      accessToken: tokens.accessToken,
      // Include refreshToken in body for mobile clients (web uses HttpOnly cookies)
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH_FAILURE, req, {
        reason: 'token_expired',
      });
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      logSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH_FAILURE, req, {
        reason: 'invalid_token',
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
