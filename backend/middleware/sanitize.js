/**
 * Input sanitization middleware for XSS prevention
 * Sanitizes string fields in request body to prevent cross-site scripting attacks
 */

const xss = require('xss');

// Configure xss library to strip all tags (no HTML allowed)
const xssOptions = {
  whiteList: {}, // No tags allowed
  stripIgnoreTag: true, // Remove all tags
  stripIgnoreTagBody: ['script', 'style'] // Remove script/style content entirely
};

/**
 * Sanitizes all top-level string fields in request body
 * - Strips HTML/script tags using xss library
 * - Trims leading/trailing whitespace
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      const value = req.body[key];
      if (typeof value === 'string') {
        // Apply XSS sanitization and trim whitespace
        req.body[key] = xss(value, xssOptions).trim();
      }
    }
  }
  next();
}

/**
 * Sanitizes email field specifically
 * - Trims whitespace
 * - Converts to lowercase for consistent storage/lookup
 */
function sanitizeEmail(req, res, next) {
  if (req.body && typeof req.body.email === 'string') {
    req.body.email = req.body.email.trim().toLowerCase();
  }
  next();
}

module.exports = {
  sanitizeBody,
  sanitizeEmail
};
