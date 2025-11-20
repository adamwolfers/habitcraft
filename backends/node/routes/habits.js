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

/**
 * DELETE /api/v1/habits/:id
 * Delete a habit by ID
 */
router.delete('/:id', mockAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Validate habit ID format
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid habit ID',
        message: 'Habit ID must be a non-empty string',
        statusCode: 400
      });
    }

    // Basic format validation - reject IDs with invalid characters
    // Allow alphanumeric, hyphens, and underscores
    const idPattern = /^[a-zA-Z0-9_-]+$/;
    if (!idPattern.test(id)) {
      return res.status(400).json({
        error: 'Invalid habit ID format',
        message: 'Habit ID contains invalid characters',
        statusCode: 400
      });
    }

    // Delete the habit (only if it belongs to the user)
    const result = await query(
      'DELETE FROM habits WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    // Check if any row was deleted
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Habit not found',
        message: 'Habit not found or access denied',
        statusCode: 404
      });
    }

    // Return 204 No Content on successful deletion
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting habit:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete habit',
      statusCode: 500
    });
  }
});

// Mount completions router
router.use('/:habitId/completions', completionsRouter);

module.exports = router;
