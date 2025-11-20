const request = require('supertest');
const app = require('../app');

// Mock the database pool module
jest.mock('../db/pool', () => ({
  query: jest.fn(),
  closePool: jest.fn()
}));

const { query, closePool } = require('../db/pool');

describe('POST /api/v1/habits', () => {
  const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closePool();
  });

  it('should create a new habit with required fields', async () => {
    const mockHabit = {
      id: 'habit-123',
      userId: TEST_USER_ID,
      name: 'Morning Exercise',
      description: null,
      frequency: 'daily',
      targetDays: [],
      color: '#3B82F6',
      icon: '⭐',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    query.mockResolvedValue({ rows: [mockHabit] });

    const habitData = {
      name: 'Morning Exercise',
      frequency: 'daily'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
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

    // Verify the database query was called correctly
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO habits'),
      [TEST_USER_ID, 'Morning Exercise', null, 'daily', [], '#3B82F6', '⭐']
    );
  });

  it('should create a habit with all optional fields', async () => {
    const mockHabit = {
      id: 'habit-456',
      userId: TEST_USER_ID,
      name: 'Read Books',
      description: 'Read for 30 minutes',
      frequency: 'daily',
      targetDays: [1, 3, 5],
      color: '#FF5733',
      icon: '📚',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    query.mockResolvedValue({ rows: [mockHabit] });

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
    expect(query).not.toHaveBeenCalled();
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
    expect(query).not.toHaveBeenCalled();
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
    expect(query).not.toHaveBeenCalled();
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
    expect(query).not.toHaveBeenCalled();
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
    expect(query).not.toHaveBeenCalled();
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
    expect(query).not.toHaveBeenCalled();
  });

  it('should apply default values for optional fields', async () => {
    const mockHabit = {
      id: 'habit-789',
      userId: TEST_USER_ID,
      name: 'Simple Habit',
      description: null,
      frequency: 'daily',
      targetDays: [],
      color: '#3B82F6',
      icon: '⭐',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    query.mockResolvedValue({ rows: [mockHabit] });

    const habitData = {
      name: 'Simple Habit',
      frequency: 'daily'
    };

    const response = await request(app)
      .post('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .send(habitData)
      .expect(201);

    expect(response.body.color).toBe('#3B82F6');
    expect(response.body.icon).toBe('⭐');
    expect(response.body.targetDays).toEqual([]);
  });
});

describe('GET /api/v1/habits', () => {
  const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closePool();
  });

  it('should return an empty array when user has no habits', async () => {
    query.mockResolvedValue({ rows: [] });

    const response = await request(app)
      .get('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      [TEST_USER_ID]
    );
  });

  it('should return all habits for the authenticated user', async () => {
    const mockHabits = [
      {
        id: 'habit-1',
        userId: TEST_USER_ID,
        name: 'Morning Exercise',
        description: null,
        frequency: 'daily',
        targetDays: [],
        color: '#3B82F6',
        icon: '⭐',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'habit-2',
        userId: TEST_USER_ID,
        name: 'Read Books',
        description: null,
        frequency: 'weekly',
        targetDays: [],
        color: '#3B82F6',
        icon: '⭐',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    query.mockResolvedValue({ rows: mockHabits });

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
    // This test verifies the query includes the user ID filter
    const mockHabits = [
      {
        id: 'habit-1',
        userId: TEST_USER_ID,
        name: 'My Habit',
        description: null,
        frequency: 'daily',
        targetDays: [],
        color: '#3B82F6',
        icon: '⭐',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    query.mockResolvedValue({ rows: mockHabits });

    const response = await request(app)
      .get('/api/v1/habits')
      .set('X-User-Id', TEST_USER_ID)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('My Habit');

    // Verify the query was called with the user ID
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $1'),
      [TEST_USER_ID]
    );
  });

  it('should filter habits by active status', async () => {
    const mockHabits = [
      {
        id: 'habit-1',
        userId: TEST_USER_ID,
        name: 'Active Habit',
        description: null,
        frequency: 'daily',
        targetDays: [],
        color: '#3B82F6',
        icon: '⭐',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    query.mockResolvedValue({ rows: mockHabits });

    const response = await request(app)
      .get('/api/v1/habits?status=active')
      .set('X-User-Id', TEST_USER_ID)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Active Habit');
    expect(response.body[0].status).toBe('active');

    // Verify the query includes the status filter
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('AND status = $2'),
      [TEST_USER_ID, 'active']
    );
  });

  it('should filter habits by archived status', async () => {
    const mockHabits = [
      {
        id: 'habit-1',
        userId: TEST_USER_ID,
        name: 'Archived Habit',
        description: null,
        frequency: 'daily',
        targetDays: [],
        color: '#3B82F6',
        icon: '⭐',
        status: 'archived',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    query.mockResolvedValue({ rows: mockHabits });

    const response = await request(app)
      .get('/api/v1/habits?status=archived')
      .set('X-User-Id', TEST_USER_ID)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Archived Habit');
    expect(response.body[0].status).toBe('archived');

    // Verify the query includes the status filter
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('AND status = $2'),
      [TEST_USER_ID, 'archived']
    );
  });

  it('should return 401 if user ID is not provided', async () => {
    const response = await request(app)
      .get('/api/v1/habits')
      .expect(401);

    expect(response.body).toHaveProperty('error');
    expect(query).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/habits/:id', () => {
  const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';
  const HABIT_ID = 'habit-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closePool();
  });

  it('should successfully delete a habit that belongs to the user', async () => {
    // Mock successful deletion (rowCount 1 means one row was deleted)
    query.mockResolvedValue({ rows: [], rowCount: 1 });

    const response = await request(app)
      .delete(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .expect(204);

    expect(response.body).toEqual({});
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM habits'),
      [HABIT_ID, TEST_USER_ID]
    );
  });

  it('should return 404 if habit does not exist', async () => {
    // Mock no rows deleted
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    const response = await request(app)
      .delete(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('not found');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('should return 404 when trying to delete another user\'s habit', async () => {
    // Mock no rows deleted (because WHERE clause includes user_id)
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    const response = await request(app)
      .delete(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND user_id = $2'),
      [HABIT_ID, TEST_USER_ID]
    );
  });

  it('should return 401 if user ID is not provided', async () => {
    const response = await request(app)
      .delete(`/api/v1/habits/${HABIT_ID}`)
      .expect(401);

    expect(response.body).toHaveProperty('error');
    expect(query).not.toHaveBeenCalled();
  });

  it('should return 400 if habit ID is invalid format', async () => {
    const invalidId = 'invalid@id!';

    const response = await request(app)
      .delete(`/api/v1/habits/${invalidId}`)
      .set('X-User-Id', TEST_USER_ID)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(query).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    query.mockRejectedValue(new Error('Database connection failed'));

    const response = await request(app)
      .delete(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .expect(500);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Internal server error');
  });
});

describe('PUT /api/v1/habits/:id', () => {
  const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';
  const HABIT_ID = 'habit-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closePool();
  });

  it('should successfully update all fields of a habit', async () => {
    const updatedHabit = {
      id: HABIT_ID,
      userId: TEST_USER_ID,
      name: 'Updated Exercise',
      description: 'New description',
      frequency: 'weekly',
      targetDays: [1, 3, 5],
      color: '#FF5733',
      icon: '🏃',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    query.mockResolvedValue({ rows: [updatedHabit], rowCount: 1 });

    const updateData = {
      name: 'Updated Exercise',
      description: 'New description',
      frequency: 'weekly',
      targetDays: [1, 3, 5],
      color: '#FF5733',
      icon: '🏃'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      id: HABIT_ID,
      name: 'Updated Exercise',
      description: 'New description',
      frequency: 'weekly',
      targetDays: [1, 3, 5],
      color: '#FF5733',
      icon: '🏃'
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE habits'),
      expect.arrayContaining([HABIT_ID, TEST_USER_ID])
    );
  });

  it('should successfully update only name field', async () => {
    const updatedHabit = {
      id: HABIT_ID,
      userId: TEST_USER_ID,
      name: 'New Name',
      description: 'Original description',
      frequency: 'daily',
      targetDays: [],
      color: '#3B82F6',
      icon: '⭐',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    query.mockResolvedValue({ rows: [updatedHabit], rowCount: 1 });

    const updateData = {
      name: 'New Name',
      frequency: 'daily' // Required field
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect(200);

    expect(response.body.name).toBe('New Name');
  });

  it('should successfully update status to archived', async () => {
    const updatedHabit = {
      id: HABIT_ID,
      userId: TEST_USER_ID,
      name: 'Exercise',
      description: null,
      frequency: 'daily',
      targetDays: [],
      color: '#3B82F6',
      icon: '⭐',
      status: 'archived',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    query.mockResolvedValue({ rows: [updatedHabit], rowCount: 1 });

    const updateData = {
      name: 'Exercise',
      frequency: 'daily',
      status: 'archived'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect(200);

    expect(response.body.status).toBe('archived');
  });

  it('should return 404 if habit does not exist', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    const updateData = {
      name: 'Updated Name',
      frequency: 'daily'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('not found');
  });

  it('should return 404 when trying to update another user\'s habit', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    const updateData = {
      name: 'Updated Name',
      frequency: 'daily'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(query).toHaveBeenCalledTimes(1);
    const [queryText, queryParams] = query.mock.calls[0];
    expect(queryText).toContain('UPDATE habits');
    expect(queryText).toContain('WHERE id =');
    expect(queryText).toContain('AND user_id =');
    expect(queryParams).toContain(HABIT_ID);
    expect(queryParams).toContain(TEST_USER_ID);
  });

  it('should return 401 if user ID is not provided', async () => {
    const updateData = {
      name: 'Updated Name',
      frequency: 'daily'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .send(updateData)
      .expect(401);

    expect(response.body).toHaveProperty('error');
    expect(query).not.toHaveBeenCalled();
  });

  it('should return 400 if habit ID is invalid format', async () => {
    const invalidId = 'invalid@id!';

    const updateData = {
      name: 'Updated Name',
      frequency: 'daily'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${invalidId}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(query).not.toHaveBeenCalled();
  });

  it('should return 400 if name is missing', async () => {
    const updateData = {
      frequency: 'daily'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(query).not.toHaveBeenCalled();
  });

  it('should return 400 if frequency is invalid', async () => {
    const updateData = {
      name: 'Valid Name',
      frequency: 'invalid-frequency'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(query).not.toHaveBeenCalled();
  });

  it('should return 400 if color is invalid', async () => {
    const updateData = {
      name: 'Valid Name',
      frequency: 'daily',
      color: 'not-a-hex-color'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(query).not.toHaveBeenCalled();
  });

  it('should return 400 if status is invalid', async () => {
    const updateData = {
      name: 'Valid Name',
      frequency: 'daily',
      status: 'invalid-status'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(query).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    query.mockRejectedValue(new Error('Database connection failed'));

    const updateData = {
      name: 'Valid Name',
      frequency: 'daily'
    };

    const response = await request(app)
      .put(`/api/v1/habits/${HABIT_ID}`)
      .set('X-User-Id', TEST_USER_ID)
      .send(updateData)
      .expect(500);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Internal server error');
  });
});
