const express = require('express');
const { query } = require('../db/pool');
const { validateHabitInput } = require('../validators/habitValidator');
const { mockAuthMiddleware } = require('../middleware/mockAuth');
const completionsRouter = require('./completions');

const router = express.Router();

/**
 * GET /api/v1/habits
 * Get all habits for the authenticated user
 */
router.get('/', mockAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId; // Set by mockAuthMiddleware
    const { status } = req.query; // Optional status filter

    // Build query based on filter
    let queryText = `
      SELECT
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
        updated_at as "updatedAt"
      FROM habits
      WHERE user_id = $1
    `;
    const queryParams = [userId];

    // Add status filter if provided
    if (status) {
      queryText += ' AND status = $2';
      queryParams.push(status);
    }

    queryText += ' ORDER BY created_at ASC';

    const result = await query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching habits:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch habits',
      statusCode: 500
    });
  }
});

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

// Mount completions router
router.use('/:habitId/completions', completionsRouter);

module.exports = router;
