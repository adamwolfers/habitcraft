/**
 * JWT Configuration Tests
 *
 * Tests for production secret enforcement and JWT configuration.
 */

describe('JWT Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to allow re-requiring with different env
    jest.resetModules();
    // Clone the environment
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Production mode (NODE_ENV=production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should throw error if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;

      expect(() => {
        require('./jwt');
      }).toThrow('JWT_SECRET environment variable is required in production');
    });

    it('should throw error if JWT_SECRET is too short (< 32 chars)', () => {
      process.env.JWT_SECRET = 'short-secret-123';

      expect(() => {
        require('./jwt');
      }).toThrow('JWT_SECRET must be at least 32 characters');
    });

    it('should throw error if JWT_SECRET contains "dev"', () => {
      process.env.JWT_SECRET = 'this-is-a-dev-secret-that-is-long-enough-now';

      expect(() => {
        require('./jwt');
      }).toThrow('appears to be a development placeholder');
    });

    it('should throw error if JWT_SECRET contains "change"', () => {
      process.env.JWT_SECRET = 'please-change-this-secret-in-production-now';

      expect(() => {
        require('./jwt');
      }).toThrow('appears to be a development placeholder');
    });

    it('should accept a valid production secret', () => {
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

      const config = require('./jwt');

      expect(config.JWT_SECRET).toBe('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6');
    });
  });

  describe('Development mode (NODE_ENV=development)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should use fallback secret if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;

      const config = require('./jwt');

      expect(config.JWT_SECRET).toBe('dev-secret-change-in-production');
    });

    it('should use provided JWT_SECRET if set', () => {
      process.env.JWT_SECRET = 'my-dev-secret';

      const config = require('./jwt');

      expect(config.JWT_SECRET).toBe('my-dev-secret');
    });
  });

  describe('Test mode (NODE_ENV=test)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should use fallback secret if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;

      const config = require('./jwt');

      expect(config.JWT_SECRET).toBe('dev-secret-change-in-production');
    });
  });

  describe('Token expiration constants', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;
    });

    it('should export ACCESS_TOKEN_EXPIRES as 15m', () => {
      const config = require('./jwt');
      expect(config.ACCESS_TOKEN_EXPIRES).toBe('15m');
    });

    it('should export REFRESH_TOKEN_EXPIRES as 7d', () => {
      const config = require('./jwt');
      expect(config.REFRESH_TOKEN_EXPIRES).toBe('7d');
    });

    it('should export ACCESS_TOKEN_MAX_AGE as 15 minutes in ms', () => {
      const config = require('./jwt');
      expect(config.ACCESS_TOKEN_MAX_AGE).toBe(15 * 60 * 1000);
    });

    it('should export REFRESH_TOKEN_MAX_AGE as 7 days in ms', () => {
      const config = require('./jwt');
      expect(config.REFRESH_TOKEN_MAX_AGE).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('Environment flags', () => {
    it('should export IS_PRODUCTION as true when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

      const config = require('./jwt');
      expect(config.IS_PRODUCTION).toBe(true);
    });

    it('should export IS_PRODUCTION as false when NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';

      const config = require('./jwt');
      expect(config.IS_PRODUCTION).toBe(false);
    });

    it('should export IS_TEST as true when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';

      const config = require('./jwt');
      expect(config.IS_TEST).toBe(true);
    });
  });
});
