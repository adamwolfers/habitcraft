const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { jwtAuthMiddleware } = require('../middleware/jwtAuth');
const { passwordChangeLimiter } = require('../middleware/rateLimiter');
const { sanitizeBody } = require('../middleware/sanitize');
const tokenService = require('../services/tokenService');
const { logSecurityEvent, SECURITY_EVENTS } = require('../utils/securityLogger');

const router = express.Router();

const USER_COLUMNS = 'id, email, name, created_at AS "createdAt"';

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or less'),
  body('email')
    .optional()
    .trim()
    .toLowerCase()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// GET /api/v1/users/me
router.get('/me', jwtAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/users/me
router.put('/me', jwtAuthMiddleware, updateProfileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email } = req.body;

    // Check if at least one field is provided
    if (!name && !email) {
      return res.status(400).json({ errors: [{ msg: 'At least one field (name or email) is required' }] });
    }

    // If email is being updated, check for uniqueness
    if (email) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0 && existingUser.rows[0].id !== req.userId) {
        return res.status(409).json({ error: 'Email is already in use' });
      }
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (email) {
      updates.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }

    updates.push('updated_at = NOW()');
    values.push(req.userId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING ${USER_COLUMNS}`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/users/me/password
router.put('/me/password', jwtAuthMiddleware, passwordChangeLimiter, sanitizeBody, changePasswordValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Fetch user with password hash
    const userResult = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE id = $1',
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      logSecurityEvent(SECURITY_EVENTS.PASSWORD_CHANGE_FAILURE, req, {
        userId: req.userId,
        reason: 'invalid_password'
      });
      return res.status(401).json({ error: 'Invalid current password' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, req.userId]
    );

    // Revoke all refresh tokens (force re-login on other devices)
    await tokenService.revokeAllUserTokens(req.userId);

    logSecurityEvent(SECURITY_EVENTS.PASSWORD_CHANGE_SUCCESS, req, {
      userId: req.userId,
      email: user.email
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
