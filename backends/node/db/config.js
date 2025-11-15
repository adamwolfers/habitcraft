/**
 * Database configuration module
 * Reads configuration from environment variables
 */

/**
 * Get database configuration from environment variables
 * @returns {Object} Database configuration object for pg.Pool
 */
function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'habittracker',
    user: process.env.DB_USER || 'habituser',
    password: process.env.DB_PASSWORD || 'habitpass',
    // Connection pool settings
    max: 20, // maximum number of clients in the pool
    idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // how long to wait when connecting a new client
  };
}

module.exports = {
  getDbConfig,
};
