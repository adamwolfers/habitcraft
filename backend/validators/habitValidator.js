/**
 * Validation middleware for habit input
 * Validates habit creation and update requests according to the OpenAPI spec
 */

const { schemaLimits } = require('./apiLimits.generated');

const VALID_STATUSES = ['active', 'archived'];
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// From the spec, not restated here: these numbers also live in the DB column
// widths and in both clients' inputs, and used to be written out independently
// in each -- mobile capped the name at 50 against a server that took 100
// (habitcraft-34d.3). apiLimits.generated.js is derived from openapi.yaml and
// CI fails if it drifts; validators/apiLimits.test.js holds the DB widths to
// the same numbers.
const MAX_NAME_LENGTH = schemaLimits.HabitInput.name.maxLength;
const MAX_DESCRIPTION_LENGTH = schemaLimits.HabitInput.description.maxLength;

function validateHabitInput(req, res, next) {
  const { name, color, description, icon, status } = req.body;
  const errors = [];

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('name is required and must be a non-empty string');
  }

  // Validate name length
  if (name && name.length > MAX_NAME_LENGTH) {
    errors.push(`name must not exceed ${MAX_NAME_LENGTH} characters`);
  }

  // Validate description length
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`);
  }

  // Validate color if provided
  if (color !== undefined) {
    if (typeof color !== 'string' || !HEX_COLOR_REGEX.test(color)) {
      errors.push('color must be a valid hex color code (e.g., #3B82F6)');
    }
  }

  // Validate icon if provided (basic validation - just check it's a string)
  if (icon !== undefined && typeof icon !== 'string') {
    errors.push('icon must be a string');
  }

  // Validate status if provided
  if (status !== undefined) {
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
  }

  // If there are validation errors, return 400
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation error',
      message: errors.join('; '),
      statusCode: 400,
    });
  }

  next();
}

module.exports = {
  validateHabitInput,
};
