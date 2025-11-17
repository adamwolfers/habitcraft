const express = require('express');
const cors = require('cors');
const { query } = require('./db/pool');
const habitsRouter = require('./routes/habits');
const app = express();

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello World!' });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    service: 'habittracker-api',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'disconnected',
  };

  try {
    // Test database connectivity
    await query('SELECT 1');
    health.database = 'connected';
    res.status(200).json(health);
  } catch (error) {
    health.status = 'unhealthy';
    health.error = error.message;
    res.status(503).json(health);
  }
});

// API routes
app.use('/api/v1/habits', habitsRouter);

module.exports = app;
