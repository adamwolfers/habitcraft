const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { jwtAuthMiddleware } = require('../middleware/jwtAuth');

const router = express.Router();

const USER_COLUMNS = 'id, email, name, created_at AS "createdAt"';

const updateProfileValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or less')
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

    const { name } = req.body;

    const result = await pool.query(
      `UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING ${USER_COLUMNS}`,
      [name, req.userId]
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
