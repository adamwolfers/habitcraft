#!/bin/sh
set -e

echo "Starting HabitCraft backend..."

# Check if tables exist, if not run migrations
echo "Checking database schema..."

# Use node to check and run migrations
node -e "
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();
  try {
    // Check if users table exists
    const result = await client.query(
      \"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')\"
    );

    if (!result.rows[0].exists) {
      console.log('Tables not found. Running schema migration...');
      const fs = require('fs');
      const schema = fs.readFileSync('/app/schema.sql', 'utf8');
      await client.query(schema);
      console.log('Schema migration completed successfully.');
    } else {
      console.log('Database schema already exists. Skipping migration.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
"

echo "Starting server..."
exec node server.js
