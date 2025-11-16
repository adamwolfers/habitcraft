const request = require('supertest');
const app = require('../app');
const { query, closePool } = require('../db/pool');

describe('POST /api/v1/habits', () => {
  // Mock user ID for testing (until auth is implemented)
  const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

  beforeAll(async () => {
    // Create a test user for our tests
    await query(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [TEST_USER_ID, 'test@example.com', 'dummy_hash', 'Test User']
    );
  });

  afterEach(async () => {
    // Clean up habits created during tests
    await query('DELETE FROM habits WHERE user_id = $1', [TEST_USER_ID]);
  });

  afterAll(async () => {
    // Clean up test user
    await query('DELETE FROM users WHERE id = $1', [TEST_USER_ID]);
    await closePool();
  });

  it('should create a new habit with required fields', async () => {
    const habitData = {
      name: 'Morning Exercise',
      frequency: 'daily'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID) // Temporary header for mock auth
      .send(habitData)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Morning Exercise',
      frequency: 'daily',
      userId: TEST_USER_ID,
      status: 'active'
    });
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
  });

  it('should create a habit with all optional fields', async () => {
    const habitData = {
      name: 'Read Books',
      description: 'Read for 30 minutes',
      frequency: 'daily',
      targetDays: [1, 3, 5],
      color: '#FF5733',
      icon: '📚'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .send(habitData)
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Read Books',
      description: 'Read for 30 minutes',
      frequency: 'daily',
      targetDays: [1, 3, 5],
      color: '#FF5733',
      icon: '📚',
      status: 'active'
    });
  });

  it('should return 400 if name is missing', async () => {
    const habitData = {
      frequency: 'daily'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .send(habitData)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 if frequency is missing', async () => {
    const habitData = {
      name: 'Test Habit'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .send(habitData)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 if frequency is invalid', async () => {
    const habitData = {
      name: 'Test Habit',
      frequency: 'invalid'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .send(habitData)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 if name is too long', async () => {
    const habitData = {
      name: 'a'.repeat(101), // Max is 100 characters
      frequency: 'daily'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .send(habitData)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 if color is invalid', async () => {
    const habitData = {
      name: 'Test Habit',
      frequency: 'daily',
      color: 'not-a-hex-color'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .send(habitData)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('should return 401 if user ID is not provided', async () => {
    const habitData = {
      name: 'Test Habit',
      frequency: 'daily'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .send(habitData)
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });

  it('should apply default values for optional fields', async () => {
    const habitData = {
      name: 'Simple Habit',
      frequency: 'daily'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .send(habitData)
      .expect(201);

    // Check database defaults are applied
    expect(response.body.color).toBe('#3B82F6'); // Default from schema
    expect(response.body.icon).toBe('⭐'); // Default from schema
    expect(response.body.targetDays).toEqual([]);
  });
});
