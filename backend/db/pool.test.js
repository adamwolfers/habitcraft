// Mock the pg module before requiring pool
const mockQuery = jest.fn();
const mockEnd = jest.fn();
const mockOn = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockQuery,
    end: mockEnd,
    on: mockOn,
    totalCount: 0,
  })),
}));

// Clear the module cache to ensure fresh pool instance
beforeEach(() => {
  jest.resetModules();
  mockQuery.mockClear();
  mockEnd.mockClear();
  mockOn.mockClear();
});

describe('Database Pool', () => {
  const originalEnv = process.env.NODE_ENV;

  afterAll(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  describe('getPool', () => {
    it('should return a pool instance', () => {
      const { getPool } = require('./pool');
      const pool = getPool();
      expect(pool).toBeDefined();
      expect(pool.totalCount).toBeDefined(); // pg.Pool has this property
    });

    it('should return the same pool instance on multiple calls (singleton)', () => {
      const { getPool } = require('./pool');
      const pool1 = getPool();
      const pool2 = getPool();
      expect(pool1).toBe(pool2);
    });
  });

  describe('query', () => {
    it('should execute a simple query successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ sum: 2 }],
        rowCount: 1,
      });

      const { query } = require('./pool');
      const result = await query('SELECT 1 + 1 AS sum');
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(result.rows[0].sum).toBe(2);
    });

    it('should execute parameterized queries', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'test' }],
        rowCount: 1,
      });

      const { query } = require('./pool');
      const result = await query('SELECT $1::text AS value', ['test']);
      expect(result.rows[0].value).toBe('test');
    });

    it('should throw error for invalid SQL', async () => {
      mockQuery.mockRejectedValueOnce(new Error('syntax error'));

      const { query } = require('./pool');
      await expect(query('INVALID SQL')).rejects.toThrow();
    });

    it('should log query details in development mode', async () => {
      // Set NODE_ENV to development
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockQuery.mockResolvedValueOnce({
        rows: [{ test: 1 }],
        rowCount: 1,
      });

      const { query } = require('./pool');
      await query('SELECT 1 AS test');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Executed query',
        expect.objectContaining({
          text: 'SELECT 1 AS test',
          rows: 1,
        })
      );

      consoleSpy.mockRestore();
      // Reset to test environment
      process.env.NODE_ENV = 'test';
    });
  });

  describe('closePool', () => {
    it('should close pool gracefully', async () => {
      mockEnd.mockResolvedValueOnce();

      const { getPool, closePool } = require('./pool');
      // First create a pool
      getPool();
      // Then close it
      await expect(closePool()).resolves.not.toThrow();
      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
