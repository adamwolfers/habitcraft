const request = require('supertest');
const app = require('./app');
const { closePool } = require('./db/pool');

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
});
