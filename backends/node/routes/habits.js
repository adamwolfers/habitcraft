const express = require('express');
const { query } = require('../db/pool');
const { validateHabitInput } = require('../validators/habitValidator');
const { mockAuthMiddleware } = require('../middleware/mockAuth');

const router = express.Router();

/**
 * POST /api/v1/habits
 * Create a new habit
 */
router.post('/', mockAuthMiddleware, validateHabitInput, async (req, res) => {
  try {
    const { name, description, frequency, targetDays, color, icon } = req.body;
    const userId = req.userId; // Set by mockAuthMiddleware

    // Insert habit into database
    const result = await query(
      `INSERT INTO habits
       (user_id, name, description, frequency, target_days, color, icon)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         id,
         user_id as "userId",
         name,
         description,
         frequency,
         target_days as "targetDays",
         color,
         icon,
         status,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [
        userId,
        name,
        description || null,
        frequency,
        targetDays || [],
        color || '#3B82F6',
        icon || '⭐'
      ]
    );

    const habit = result.rows[0];
    res.status(201).json(habit);
  } catch (error) {
    console.error('Error creating habit:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create habit',
      statusCode: 500
    });
  }
});

module.exports = router;
