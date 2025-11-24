const { getPool, query, closePool } = require('./pool');

describe('Database Pool', () => {
  const originalEnv = process.env.NODE_ENV;

  afterAll(async () => {
    // Clean up: close the pool after all tests
    await closePool();
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  describe('getPool', () => {
    it('should return a pool instance', () => {
      const pool = getPool();
      expect(pool).toBeDefined();
      expect(pool.totalCount).toBeDefined(); // pg.Pool has this property
    });

    it('should return the same pool instance on multiple calls (singleton)', () => {
      const pool1 = getPool();
      const pool2 = getPool();
      expect(pool1).toBe(pool2);
    });
  });

  describe('query', () => {
    it('should execute a simple query successfully', async () => {
      const result = await query('SELECT 1 + 1 AS sum');
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(result.rows[0].sum).toBe(2);
    });

    it('should execute parameterized queries', async () => {
      const result = await query('SELECT $1::text AS value', ['test']);
      expect(result.rows[0].value).toBe('test');
    });

    it('should throw error for invalid SQL', async () => {
      await expect(query('INVALID SQL')).rejects.toThrow();
    });

    it('should log query details in development mode', async () => {
      // Set NODE_ENV to development
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await query('SELECT 1 AS test');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Executed query',
        expect.objectContaining({
          text: 'SELECT 1 AS test',
          rows: 1
        })
      );

      consoleSpy.mockRestore();
      // Reset to test environment
      process.env.NODE_ENV = 'test';
    });
  });

  describe('closePool', () => {
    it('should close pool gracefully', async () => {
      // This test will run after other tests due to afterAll
      // Just verify it doesn't throw
      await expect(closePool()).resolves.not.toThrow();
    });
  });
});
