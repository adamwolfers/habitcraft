const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../db/pool');
const { rateOver } = require('./habitStats');

jest.mock('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const habitId = '223e4567-e89b-12d3-a456-426614174000';
const mockToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
  expiresIn: '15m',
});

/** The date `days` days before today in UTC, YYYY-MM-DD. */
function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function getStats() {
  return request(app)
    .get(`/api/v1/habits/${habitId}/stats`)
    .set('Authorization', `Bearer ${mockToken}`);
}

const rate = (completedDays, totalDays) => ({
  completedDays,
  totalDays,
  rate: completedDays / totalDays,
});

describe('rateOver', () => {
  const end = '2026-03-31';

  it('counts the days done in a window ending on the last day', () => {
    expect(rateOver(['2026-03-31', '2026-03-02', '2026-03-01'], '2025-01-01', end, 30)).toEqual(
      rate(2, 30)
    );
  });

  it('cuts the window to the start when the habit started later', () => {
    expect(rateOver(['2026-03-31', '2026-03-29'], '2026-03-29', end, 30)).toEqual(rate(2, 3));
  });

  it('counts a habit that started today as one day', () => {
    expect(rateOver([], end, end, 365)).toEqual(rate(0, 1));
  });

  it('spans a leap day', () => {
    expect(rateOver([], '2024-01-01', '2024-03-01', 365)).toEqual(rate(0, 61));
  });
});

describe('GET /api/v1/habits/:habitId/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports both windows from the habit start and its days done', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: habitId, user_id: mockUserId }] });
    pool.query.mockResolvedValueOnce({ rows: [{ start: daysAgo(9) }] });
    pool.query.mockResolvedValueOnce({
      rows: [{ date: daysAgo(0) }, { date: daysAgo(4) }, { date: daysAgo(9) }],
    });

    const response = await getStats();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      habitId,
      last30Days: rate(3, 10),
      last365Days: rate(3, 10),
    });
  });

  it("reads the habit's start and only the last 365 days done", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: habitId, user_id: mockUserId }] });
    pool.query.mockResolvedValueOnce({ rows: [{ start: daysAgo(500) }] });
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await getStats();

    expect(response.status).toBe(200);
    expect(response.body.last365Days).toEqual(rate(0, 365));
    const [startSql, startParams] = pool.query.mock.calls[1];
    expect(startSql).toMatch(/LEAST/);
    expect(startParams).toEqual([habitId]);
    expect(pool.query.mock.calls[2][1]).toEqual([habitId, daysAgo(364), daysAgo(0)]);
  });

  it('is a 404 for a missing habit', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await getStats();

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Habit not found' });
  });

  it("is a 403 for another user's habit", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: habitId, user_id: 'someone-else' }] });

    const response = await getStats();

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Access denied' });
  });

  it('is a 500 without detail when the database fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockRejectedValueOnce(new Error('connection refused'));

    const response = await getStats();

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
  });

  it('needs signing in', async () => {
    const response = await request(app).get(`/api/v1/habits/${habitId}/stats`);

    expect(response.status).toBe(401);
  });
});
