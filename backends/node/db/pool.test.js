const { getPool, query, closePool } = require('./pool');

describe('Database Pool', () => {
  afterAll(async () => {
    // Clean up: close the pool after all tests
    await closePool();
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
  });

  describe('closePool', () => {
    it('should close pool gracefully', async () => {
      // This test will run after other tests due to afterAll
      // Just verify it doesn't throw
      await expect(closePool()).resolves.not.toThrow();
    });
  });
});
