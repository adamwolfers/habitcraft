const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { jwtAuthMiddleware } = require('../middleware/jwtAuth');

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

module.exports = router;
