// Load environment variables before running tests
require('dotenv').config();

// Skip rate limiting in unit tests to avoid test interference
// Rate limiting is tested explicitly in rateLimiter.test.js
process.env.SKIP_RATE_LIMIT = 'true';
