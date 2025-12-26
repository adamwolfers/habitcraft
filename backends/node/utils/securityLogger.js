const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  TOKEN_REFRESH_SUCCESS: 'TOKEN_REFRESH_SUCCESS',
  TOKEN_REFRESH_FAILURE: 'TOKEN_REFRESH_FAILURE',
  LOGOUT: 'LOGOUT',
  AUTH_FAILURE: 'AUTH_FAILURE',
  PASSWORD_CHANGE_SUCCESS: 'PASSWORD_CHANGE_SUCCESS',
  PASSWORD_CHANGE_FAILURE: 'PASSWORD_CHANGE_FAILURE'
};

function getClientIp(req) {
  // Check x-forwarded-for header for proxied requests
  const forwardedFor = req.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (original client)
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip;
}

function logSecurityEvent(event, req, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip: getClientIp(req),
    userAgent: req.get('user-agent') || null,
    ...details
  };

  // Include path for auth failure events
  if (event === SECURITY_EVENTS.AUTH_FAILURE && req.path) {
    logEntry.path = req.path;
  }

  console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
}

module.exports = {
  logSecurityEvent,
  SECURITY_EVENTS
};
