const express = require('express');
const pool = require('../db/pool');
const { jwtAuthMiddleware } = require('../middleware/jwtAuth');

const router = express.Router({ mergeParams: true });

// Helper function to validate date format (YYYY-MM-DD)
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return false;
  }
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && dateString === date.toISOString().split('T')[0];
}

// Helper function to check if a date is in the future
function isFutureDate(dateString) {
  const today = new Date().toISOString().split('T')[0];
  return dateString > today;
}

// Helper function to verify habit ownership
async function verifyHabitOwnership(habitId, userId) {
  const result = await pool.query(
    'SELECT id, user_id FROM habits WHERE id = $1',
    [habitId]
  );

  if (result.rows.length === 0) {
    return { exists: false, owned: false };
  }

  return {
    exists: true,
    owned: result.rows[0].user_id === userId
  };
}

// POST /api/v1/habits/:habitId/completions
router.post('/', jwtAuthMiddleware, async (req, res) => {
  try {
    const { habitId } = req.params;
    const { date, notes } = req.body;
    const userId = req.userId;

    // Validate date
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Check if date is in the future
    if (isFutureDate(date)) {
      return res.status(400).json({ error: 'Cannot mark completions for future dates' });
    }

    // Verify habit exists and belongs to user
    const habitCheck = await verifyHabitOwnership(habitId, userId);

    if (!habitCheck.exists) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    if (!habitCheck.owned) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Insert completion
    try {
      const result = await pool.query(
        `INSERT INTO completions (habit_id, date, notes)
         VALUES ($1, $2, $3)
         RETURNING
           id,
           habit_id AS "habitId",
           date,
           notes,
           created_at AS "createdAt"`,
        [habitId, date, notes || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      // Check for duplicate completion
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Habit already completed for this date' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating completion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/habits/:habitId/completions
router.get('/', jwtAuthMiddleware, async (req, res) => {
  try {
    const { habitId } = req.params;
    const { startDate, endDate } = req.query;
    const userId = req.userId;

    // Verify habit exists and belongs to user
    const habitCheck = await verifyHabitOwnership(habitId, userId);

    if (!habitCheck.exists) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    if (!habitCheck.owned) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build query with optional date filters
    let query = `
      SELECT
        id,
        habit_id AS "habitId",
        date,
        notes,
        created_at AS "createdAt"
      FROM completions
      WHERE habit_id = $1
    `;

    const params = [habitId];
    let paramIndex = 2;

    if (startDate && endDate) {
      query += ` AND date >= $${paramIndex} AND date <= $${paramIndex + 1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    } else if (startDate) {
      query += ` AND date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    } else if (endDate) {
      query += ` AND date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ' ORDER BY date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching completions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/habits/:habitId/completions/:date
router.delete('/:date', jwtAuthMiddleware, async (req, res) => {
  try {
    const { habitId, date } = req.params;
    const userId = req.userId;

    // Validate date
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Verify habit exists and belongs to user
    const habitCheck = await verifyHabitOwnership(habitId, userId);

    if (!habitCheck.exists) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    if (!habitCheck.owned) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete completion
    const result = await pool.query(
      'DELETE FROM completions WHERE habit_id = $1 AND date = $2 RETURNING id',
      [habitId, date]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Completion not found' });
    }

    res.status(200).json({
      message: 'Completion deleted successfully',
      habitId: habitId,
      date: date
    });
  } catch (error) {
    console.error('Error deleting completion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
