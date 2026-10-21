const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../db/pool');
const { MAX_RANGE_DAYS } = require('./completionsRange');

jest.mock('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockToken = jwt.sign({ userId: mockUserId, type: 'access' }, JWT_SECRET, {
  expiresIn: '15m',
});

/** The date `days` after `date`, both YYYY-MM-DD. */
function addDays(date, days) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function get(query) {
  return request(app)
    .get('/api/v1/completions')
    .query(query)
    .set('Authorization', `Bearer ${mockToken}`);
}

describe('GET /api/v1/completions', () => {
  const startDate = '2025-01-01';
  const endDate = '2025-01-31';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("groups the user's completions in the range by habit", async () => {
    const run = {
      id: 'completion-1',
      habitId: 'habit-run',
      date: '2025-01-15',
      notes: null,
      createdAt: '2025-01-15T10:00:00.000Z',
    };
    const earlierRun = { ...run, id: 'completion-2', date: '2025-01-02' };
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'habit-run' }, { id: 'habit-read' }] });
    pool.query.mockResolvedValueOnce({ rows: [run, earlierRun] });

    const response = await get({ startDate, endDate });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { habitId: 'habit-run', completions: [run, earlierRun] },
      { habitId: 'habit-read', completions: [] },
    ]);
  });

  it("reads only the user's habits, oldest first, and only the range's days", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'habit-run' }] });
    pool.query.mockResolvedValueOnce({ rows: [] });

    await get({ startDate, endDate });

    const [habitsSql, habitsParams] = pool.query.mock.calls[0];
    expect(habitsSql).toContain('WHERE user_id = $1');
    expect(habitsSql).toContain('ORDER BY created_at ASC, id ASC');
    expect(habitsParams).toEqual([mockUserId]);

    const [completionsSql, completionsParams] = pool.query.mock.calls[1];
    expect(completionsSql).toContain('h.user_id = $1');
    expect(completionsSql).toContain('c.date >= $2 AND c.date <= $3');
    expect(completionsSql).toContain('ORDER BY c.date DESC');
    expect(completionsSql).toContain("TO_CHAR(c.date, 'YYYY-MM-DD')");
    expect(completionsParams).toEqual([mockUserId, startDate, endDate]);
  });

  it('skips the completions query when the user has no habits', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await get({ startDate, endDate });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('accepts a single day', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await get({ startDate, endDate: startDate });

    expect(response.status).toBe(200);
  });

  it('accepts the longest range allowed', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await get({ startDate, endDate: addDays(startDate, MAX_RANGE_DAYS - 1) });

    expect(response.status).toBe(200);
  });

  it('refuses a range one day longer than allowed', async () => {
    const response = await get({ startDate, endDate: addDays(startDate, MAX_RANGE_DAYS) });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: `The range can be at most ${MAX_RANGE_DAYS} days` });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('refuses an endDate before the startDate', async () => {
    const response = await get({ startDate, endDate: addDays(startDate, -1) });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'endDate must not be before startDate' });
  });

  it.each([
    ['no startDate', { endDate }],
    ['no endDate', { startDate }],
  ])('refuses %s', async (_, query) => {
    const response = await get(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'startDate and endDate are required' });
  });

  it.each([
    ['a malformed date', { startDate: 'not-a-date', endDate }],
    ['an impossible date', { startDate, endDate: '2025-02-30' }],
    ['a repeated parameter', { startDate: [startDate, endDate], endDate }],
  ])('refuses %s', async (_, query) => {
    const response = await get(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid date format. Use YYYY-MM-DD' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/v1/completions').query({ startDate, endDate });

    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('answers a database failure with a 500', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockRejectedValueOnce(new Error('connection lost'));

    const response = await get({ startDate, endDate });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
    console.error.mockRestore();
  });
});
