/**
 * Validation middleware for habit input
 * Validates habit creation and update requests according to the OpenAPI spec
 */

const VALID_FREQUENCIES = ['daily', 'weekly'];
const VALID_STATUSES = ['active', 'archived'];
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

function validateHabitInput(req, res, next) {
  const { name, frequency, color, description, icon, status } = req.body;
  const errors = [];

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('name is required and must be a non-empty string');
  }

  if (!frequency || typeof frequency !== 'string') {
    errors.push('frequency is required and must be a string');
  }

  // Validate name length
  if (name && name.length > MAX_NAME_LENGTH) {
    errors.push(`name must not exceed ${MAX_NAME_LENGTH} characters`);
  }

  // Validate description length
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`);
  }

  // Validate frequency value
  if (frequency && !VALID_FREQUENCIES.includes(frequency)) {
    errors.push(`frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`);
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
