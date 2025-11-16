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

describe('GET /api/v1/habits', () => {
  const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';
  const OTHER_USER_ID = '223e4567-e89b-12d3-a456-426614174001';

  beforeAll(async () => {
    // Create test users
    await query(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [TEST_USER_ID, 'test@example.com', 'dummy_hash', 'Test User']
    );
    await query(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [OTHER_USER_ID, 'other@example.com', 'dummy_hash', 'Other User']
    );
  });

  afterEach(async () => {
    // Clean up habits created during tests
    await query('DELETE FROM habits WHERE user_id IN ($1, $2)', [TEST_USER_ID, OTHER_USER_ID]);
  });

  afterAll(async () => {
    // Clean up test users
    await query('DELETE FROM users WHERE id IN ($1, $2)', [TEST_USER_ID, OTHER_USER_ID]);
    await closePool();
  });

  it('should return an empty array when user has no habits', async () => {
    const response = await request(app)
      .get('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('should return all habits for the authenticated user', async () => {
    // Create test habits
    const habit1 = await query(
      `INSERT INTO habits (user_id, name, frequency)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [TEST_USER_ID, 'Morning Exercise', 'daily']
    );
    const habit2 = await query(
      `INSERT INTO habits (user_id, name, frequency)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [TEST_USER_ID, 'Read Books', 'weekly']
    );

    const response = await request(app)
      .get('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toMatchObject({
      name: 'Morning Exercise',
      frequency: 'daily',
      userId: TEST_USER_ID,
      status: 'active'
    });
    expect(response.body[1]).toMatchObject({
      name: 'Read Books',
      frequency: 'weekly',
      userId: TEST_USER_ID,
      status: 'active'
    });
  });

  it('should only return habits belonging to the authenticated user', async () => {
    // Create habits for both users
    await query(
      `INSERT INTO habits (user_id, name, frequency)
       VALUES ($1, $2, $3)`,
      [TEST_USER_ID, 'My Habit', 'daily']
    );
    await query(
      `INSERT INTO habits (user_id, name, frequency)
       VALUES ($1, $2, $3)`,
      [OTHER_USER_ID, 'Other User Habit', 'daily']
    );

    const response = await request(app)
      .get('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('My Habit');
  });

  it('should filter habits by active status', async () => {
    // Create active and archived habits
    await query(
      `INSERT INTO habits (user_id, name, frequency, status)
       VALUES ($1, $2, $3, $4)`,
      [TEST_USER_ID, 'Active Habit', 'daily', 'active']
    );
    await query(
      `INSERT INTO habits (user_id, name, frequency, status)
       VALUES ($1, $2, $3, $4)`,
      [TEST_USER_ID, 'Archived Habit', 'daily', 'archived']
    );

    const response = await request(app)
      .get('/api/v1/habits?status=active')
      .set('X-User-Id', TEST_USER_ID)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Active Habit');
    expect(response.body[0].status).toBe('active');
  });

  it('should filter habits by archived status', async () => {
    // Create active and archived habits
    await query(
      `INSERT INTO habits (user_id, name, frequency, status)
       VALUES ($1, $2, $3, $4)`,
      [TEST_USER_ID, 'Active Habit', 'daily', 'active']
    );
    await query(
      `INSERT INTO habits (user_id, name, frequency, status)
       VALUES ($1, $2, $3, $4)`,
      [TEST_USER_ID, 'Archived Habit', 'daily', 'archived']
    );

    const response = await request(app)
      .get('/api/v1/habits?status=archived')
      .set('X-User-Id', TEST_USER_ID)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Archived Habit');
    expect(response.body[0].status).toBe('archived');
  });

  it('should return 401 if user ID is not provided', async () => {
    const response = await request(app)
      .get('/api/v1/habits')
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });
});
