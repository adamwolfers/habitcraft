const request = require('supertest');
const { closePool } = require('./db/pool');

// Mock the query function
jest.mock('./db/pool', () => {
  const original = jest.requireActual('./db/pool');
  return {
    ...original,
    query: jest.fn(original.query)
  };
});

const pool = require('./db/pool');
const app = require('./app');

describe('GET /hello', () => {
  it('should return hello world message', async () => {
    const response = await request(app)
      .get('/hello')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      message: 'Hello World!'
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
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('database', 'connected');
  });

  it('should include service information', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('service', 'habittracker-api');
    expect(response.body).toHaveProperty('version');
  });

  it('should return unhealthy status when database connection fails', async () => {
    // Mock query to simulate database error
    pool.query.mockRejectedValueOnce(new Error('Connection failed'));

    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(503);

    expect(response.body).toHaveProperty('status', 'unhealthy');
    expect(response.body).toHaveProperty('database', 'disconnected');
    expect(response.body).toHaveProperty('error', 'Connection failed');
  });
});
