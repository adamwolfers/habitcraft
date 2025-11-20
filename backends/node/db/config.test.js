const { getDbConfig } = require('./config');

describe('Database Config', () => {
  describe('getDbConfig', () => {
    it('should return database configuration object', () => {
      const config = getDbConfig();
      expect(config).toBeDefined();
      expect(config.host).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.database).toBeDefined();
      expect(config.user).toBeDefined();
      expect(config.password).toBeDefined();
    });

    it('should use environment variables for configuration', () => {
      const config = getDbConfig();
      // Check that it reads from env (we know .env exists)
      expect(config.host).toBe(process.env.DB_HOST || 'localhost');
      expect(config.port).toBe(parseInt(process.env.DB_PORT || '5432'));
      expect(config.database).toBe(process.env.DB_NAME || 'habitcraft');
      expect(config.user).toBe(process.env.DB_USER || 'habituser');
    });

    it('should include connection pool settings', () => {
      const config = getDbConfig();
      expect(config.max).toBeDefined(); // max pool size
      expect(config.idleTimeoutMillis).toBeDefined();
      expect(config.connectionTimeoutMillis).toBeDefined();
    });
  });
});
