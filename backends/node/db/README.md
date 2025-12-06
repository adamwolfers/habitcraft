# Database Module

PostgreSQL database connection module for the HabitCraft Node.js backend.

## Overview

This module provides a connection pool and query interface for PostgreSQL database operations.

## Structure

```
db/
├── config.js       # Database configuration from environment variables
├── config.test.js  # Tests for configuration module
├── pool.js         # Connection pool and query interface
├── pool.test.js    # Tests for pool module
└── README.md       # This file
```

## Usage

### Basic Query

```javascript
const { query } = require('./db/pool');

// Simple query
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
console.log(result.rows);
```

### Get Pool Instance

```javascript
const { getPool } = require('./db/pool');

// Get the singleton pool instance
const pool = getPool();

// Use pool for transactions or advanced operations
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO users...');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### Close Pool (for testing or shutdown)

```javascript
const { closePool } = require('./db/pool');

// Gracefully close all connections
await closePool();
```

## Configuration

Configuration is loaded from environment variables via `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=habittracker
DB_USER=habituser
DB_PASSWORD=habitpass
```

### Connection Pool Settings

- **Max connections**: 20
- **Idle timeout**: 30 seconds
- **Connection timeout**: 2 seconds

These can be adjusted in `db/config.js` if needed.

## Testing

All database modules follow TDD (Test-Driven Development):

```bash
# Run all database tests
npm test -- db/

# Run specific test file
npm test -- db/pool.test.js

# Watch mode
npm run test:watch -- db/
```

## Health Check

The `/health` endpoint uses the database module to verify connectivity:

```bash
curl http://localhost:3000/health
```

Response when healthy:
```json
{
  "service": "habittracker-api",
  "version": "1.0.0",
  "status": "healthy",
  "timestamp": "2025-11-15T20:26:50.439Z",
  "database": "connected"
}
```

## Error Handling

- All queries log errors to console
- Errors are propagated to calling code for proper handling
- Pool errors are logged via event listener
- Development mode includes query timing information

## Next Steps

- Add database migrations
- Implement repository pattern for data access
- Add query result caching
- Create transaction helper utilities
