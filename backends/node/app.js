// HabitCraft Backend API Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { query } = require('./db/pool');
const habitsRouter = require('./routes/habits');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const app = express();

// Trust proxy headers (required for Cloud Run / load balancers)
// This enables express-rate-limit to correctly identify clients via X-Forwarded-For
app.set('trust proxy', true);

// Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));

// Middleware
// Parse allowed origins from FRONTEND_URL (comma-separated) or derive www/apex variants
const parseAllowedOrigins = () => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3100';
  // Support comma-separated list of origins
  if (frontendUrl.includes(',')) {
    return frontendUrl.split(',').map(url => url.trim());
  }
  // Auto-derive www/apex variants for production domains
  try {
    const url = new URL(frontendUrl);
    if (url.hostname.startsWith('www.')) {
      // www variant provided, also allow apex
      const apex = `${url.protocol}//${url.hostname.slice(4)}`;
      return [frontendUrl, apex];
    } else if (!url.hostname.includes('.') || url.hostname === 'localhost') {
      // localhost or simple hostname, just use as-is
      return [frontendUrl];
    } else {
      // apex variant provided, also allow www
      const www = `${url.protocol}//www.${url.hostname}`;
      return [frontendUrl, www];
    }
  } catch {
    return [frontendUrl];
  }
};
const allowedOrigins = parseAllowedOrigins();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed'), false);
  },
  credentials: true // Allow cookies to be sent cross-origin
}));
app.use(cookieParser());
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
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/habits', habitsRouter);

module.exports = app;
