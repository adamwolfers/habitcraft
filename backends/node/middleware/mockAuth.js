/**
 * Mock authentication middleware
 * This is a temporary solution until proper JWT authentication is implemented
 *
 * In production, this will be replaced with real JWT verification
 * that extracts the user ID from the token
 */

function mockAuthMiddleware(req, res, next) {
  // For now, we expect the user ID to be passed in the X-User-Id header
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      statusCode: 401
    });
  }

  // Attach userId to request object for use in route handlers
  req.userId = userId;
  next();
}

module.exports = {
  mockAuthMiddleware
};
