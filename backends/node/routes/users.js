const express = require('express');
const pool = require('../db/pool');
const { jwtAuthMiddleware } = require('../middleware/jwtAuth');

const router = express.Router();

// GET /api/v1/users/me
router.get('/me', jwtAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, created_at AS "createdAt" FROM users WHERE id = $1',
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

module.exports = router;
