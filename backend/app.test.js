const request = require('supertest');
const { closePool } = require('./db/pool');

// Mock the query function
jest.mock('./db/pool', () => {
  const original = jest.requireActual('./db/pool');
  return {
    ...original,
    query: jest.fn(original.query),
  };
});

const pool = require('./db/pool');
const app = require('./app');

describe('GET /hello', () => {
  it('should return hello world message', async () => {
    const response = await request(app).get('/hello').expect('Content-Type', /json/).expect(200);

    expect(response.body).toEqual({
      message: 'Hello World!',
    });
  });
});

describe('GET /health', () => {
  beforeEach(() => {
    // Reset mock between tests
    pool.query.mockClear();
  });

  afterAll(async () => {
    // Clean up database connection
    await closePool();
  });

  it('should return healthy status when database is connected', async () => {
    // Mock successful database query
    pool.query.mockResolvedValueOnce({ rows: [{ result: 1 }] });

    const response = await request(app).get('/health').expect('Content-Type', /json/).expect(200);

    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('database', 'connected');
  });

  it('should include service information', async () => {
    // Mock successful database query
    pool.query.mockResolvedValueOnce({ rows: [{ result: 1 }] });

    const response = await request(app).get('/health').expect(200);

    expect(response.body).toHaveProperty('service', 'habittracker-api');
    expect(response.body).toHaveProperty('version');
  });

  it('should return unhealthy status when database connection fails', async () => {
    // Mock query to simulate database error
    pool.query.mockRejectedValueOnce(new Error('Connection failed'));

    const response = await request(app).get('/health').expect('Content-Type', /json/).expect(503);

    expect(response.body).toHaveProperty('status', 'unhealthy');
    expect(response.body).toHaveProperty('database', 'disconnected');
    expect(response.body).toHaveProperty('error', 'Connection failed');
  });
});

describe("proxy trust ('trust proxy')", () => {
  it('trusts a bounded number of hops, not the whole forwarded chain', () => {
    expect(app.get('trust proxy')).toBe(1);
    // Blanket `true` would also satisfy a check for "not false", so assert the
    // type: only a hop count bounds how much of X-Forwarded-For is believed.
    expect(typeof app.get('trust proxy')).toBe('number');
  });

  it('stops trusting at the first hop, so a forged chain cannot set req.ip', () => {
    const trust = app.get('trust proxy fn');

    // Index 0 is the proxy that actually connected -- in production the Cloud
    // Run front end, which appends the real client address.
    expect(trust('203.0.113.1', 0)).toBe(true);
    // Anything further out is whatever the caller wrote, so it is not trusted.
    // Under `trust proxy: true` every one of these returned true, which is how
    // a client could pick its own req.ip and defeat the rate limiters.
    expect(trust('203.0.113.1', 1)).toBe(false);
    expect(trust('203.0.113.1', 2)).toBe(false);
  });
});
