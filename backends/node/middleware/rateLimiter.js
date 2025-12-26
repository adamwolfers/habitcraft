const rateLimit = require('express-rate-limit');

// Skip rate limiting in test environment unless explicitly testing rate limiting
// Integration tests set SKIP_RATE_LIMIT=true, unit tests for rate limiting don't
const shouldSkip = () => process.env.SKIP_RATE_LIMIT === 'true';

// Rate limiter for login endpoint - strict to prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    statusCode: 429
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: shouldSkip
});

// Rate limiter for registration endpoint - moderate to prevent spam
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 registration attempts per hour
  message: {
    error: 'Too many registration attempts',
    message: 'Too many accounts created from this IP, please try again after an hour',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip
});

// Rate limiter for token refresh - allows normal usage but prevents abuse
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 refresh attempts per 15 minutes
  message: {
    error: 'Too many refresh attempts',
    message: 'Too many token refresh attempts from this IP, please try again later',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip
});

// Rate limiter for password change - strict to prevent brute force attacks
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many password change attempts',
    message: 'Too many password change attempts from this IP, please try again after 15 minutes',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip
});

module.exports = {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  passwordChangeLimiter
};
