const express = require('express');
const pool = require('../db/pool');
const { jwtAuthMiddleware } = require('../middleware/jwtAuth');
const { verifyHabitOwnership } = require('./completions');

const router = express.Router({ mergeParams: true });

// The windows getHabitStats measures, each ending today. The Go server's
// shortWindowDays and longWindowDays are the same.
const SHORT_WINDOW_DAYS = 30;
const LONG_WINDOW_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The date `days` days after `date` (before it, when negative).
 * @param {string} date YYYY-MM-DD
 * @param {number} days
 * @returns {string} YYYY-MM-DD
 */
function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * How often a habit was done in the window of `days` days ending on `end`,
 * cut to `start` when the habit started later.
 * @param {string[]} done Days done, YYYY-MM-DD
 * @param {string} start The habit's first day, YYYY-MM-DD
 * @param {string} end The window's last day, YYYY-MM-DD
 * @param {number} days The window's length
 * @returns {{completedDays: number, totalDays: number, rate: number}}
 */
function rateOver(done, start, end, days) {
  const windowStart = addDays(end, 1 - days);
  const from = start > windowStart ? start : windowStart;
  const totalDays = (Date.parse(end) - Date.parse(from)) / DAY_MS + 1;
  const completedDays = done.filter((day) => day >= from && day <= end).length;
  return { completedDays, totalDays, rate: completedDays / totalDays };
}

// GET /api/v1/habits/:habitId/stats
//
// A habit starts on the earlier of its creation day in UTC and its first
// completion, since a day before creation can be checked off, so a rate is
// never above 1 and today always counts.
router.get('/', jwtAuthMiddleware, async (req, res) => {
  try {
    const { habitId } = req.params;
    const habitCheck = await verifyHabitOwnership(habitId, req.userId);
    if (!habitCheck.exists) {
      return res.status(404).json({ error: 'Habit not found' });
    }
    if (!habitCheck.owned) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const startResult = await pool.query(
      `SELECT TO_CHAR(LEAST(
         (created_at AT TIME ZONE 'UTC')::date,
         (SELECT MIN(date) FROM completions WHERE habit_id = habits.id)
       ), 'YYYY-MM-DD') AS start
       FROM habits WHERE id = $1`,
      [habitId]
    );
    const doneResult = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date FROM completions
       WHERE habit_id = $1 AND date >= $2 AND date <= $3`,
      [habitId, addDays(today, 1 - LONG_WINDOW_DAYS), today]
    );
    const { start } = startResult.rows[0];
    const done = doneResult.rows.map((row) => row.date);

    res.json({
      habitId,
      last30Days: rateOver(done, start, today, SHORT_WINDOW_DAYS),
      last365Days: rateOver(done, start, today, LONG_WINDOW_DAYS),
    });
  } catch (error) {
    console.error('Error computing habit stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.rateOver = rateOver;
