const express = require('express');
const pool = require('../db/pool');
const { jwtAuthMiddleware } = require('../middleware/jwtAuth');
const { isValidDate } = require('./completions');

const router = express.Router();

// A year and a day, both ends included, so a year ago today is in reach. The
// spec states it in listCompletionsInRange's description; it is not a JSON
// Schema keyword, so codegen has no number to hand over. The Go server's
// maxRangeDays is the same.
const MAX_RANGE_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns an error message when the range is not one the spec allows, else
 * null.
 * @param {unknown} startDate The startDate query parameter
 * @param {unknown} endDate The endDate query parameter
 * @returns {string|null}
 */
function validateRange(startDate, endDate) {
  if (startDate === undefined || endDate === undefined) {
    return 'startDate and endDate are required';
  }
  // A repeated parameter arrives as an array, which is no date either.
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return 'Invalid date format. Use YYYY-MM-DD';
  }
  if (endDate < startDate) {
    return 'endDate must not be before startDate';
  }
  const days = (Date.parse(endDate) - Date.parse(startDate)) / DAY_MS + 1;
  if (days > MAX_RANGE_DAYS) {
    return `The range can be at most ${MAX_RANGE_DAYS} days`;
  }
  return null;
}

// GET /api/v1/completions?startDate&endDate
router.get('/', jwtAuthMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const rangeError = validateRange(startDate, endDate);
    if (rangeError) {
      return res.status(400).json({ error: rangeError });
    }
    const userId = req.userId;

    const habits = await pool.query(
      'SELECT id FROM habits WHERE user_id = $1 ORDER BY created_at ASC, id ASC',
      [userId]
    );
    if (habits.rows.length === 0) {
      return res.json([]);
    }

    const completions = await pool.query(
      `SELECT
         c.id,
         c.habit_id AS "habitId",
         TO_CHAR(c.date, 'YYYY-MM-DD') AS date,
         c.notes,
         c.created_at AS "createdAt"
       FROM completions c JOIN habits h ON h.id = c.habit_id
       WHERE h.user_id = $1 AND c.date >= $2 AND c.date <= $3
       ORDER BY c.date DESC`,
      [userId, startDate, endDate]
    );

    const byHabit = new Map(habits.rows.map(({ id }) => [id, []]));
    for (const completion of completions.rows) {
      // A habit created between the two queries is not in byHabit.
      byHabit.get(completion.habitId)?.push(completion);
    }
    res.json([...byHabit].map(([habitId, list]) => ({ habitId, completions: list })));
  } catch (error) {
    console.error('Error fetching completions in a range:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.MAX_RANGE_DAYS = MAX_RANGE_DAYS;
