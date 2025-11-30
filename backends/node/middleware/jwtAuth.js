const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const { logSecurityEvent, SECURITY_EVENTS } = require('../utils/securityLogger');

function jwtAuthMiddleware(req, res, next) {
  // Try to get token from: 1) Cookie, 2) Authorization header
  let token = null;

  // 1. Check HttpOnly cookie first (most secure)
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  // 2. Fall back to Authorization header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      } else {
        logSecurityEvent(SECURITY_EVENTS.AUTH_FAILURE, req, {
          reason: 'invalid_format'
        });
        return res.status(401).json({ error: 'Invalid token format' });
      }
    }
  }

  if (!token) {
    logSecurityEvent(SECURITY_EVENTS.AUTH_FAILURE, req, {
      reason: 'no_token'
    });
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'access') {
      logSecurityEvent(SECURITY_EVENTS.AUTH_FAILURE, req, {
        reason: 'invalid_token_type'
      });
      return res.status(401).json({ error: 'Invalid token type' });
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logSecurityEvent(SECURITY_EVENTS.AUTH_FAILURE, req, {
        reason: 'token_expired'
      });
      return res.status(401).json({ error: 'Token expired' });
    }
    logSecurityEvent(SECURITY_EVENTS.AUTH_FAILURE, req, {
      reason: 'invalid_token'
    });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { jwtAuthMiddleware };
