/**
 * Security event logging utility for authentication and authorization events
 */
const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  TOKEN_REFRESH_SUCCESS: 'TOKEN_REFRESH_SUCCESS',
  TOKEN_REFRESH_FAILURE: 'TOKEN_REFRESH_FAILURE',
  LOGOUT: 'LOGOUT',
  AUTH_FAILURE: 'AUTH_FAILURE',
  PASSWORD_CHANGE_SUCCESS: 'PASSWORD_CHANGE_SUCCESS',
  PASSWORD_CHANGE_FAILURE: 'PASSWORD_CHANGE_FAILURE',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
};

function getClientIp(req) {
  // Use req.ip, which Express resolves from X-Forwarded-For using the bounded
  // 'trust proxy' hop count (config/proxy.js). Reading the header here instead
  // would take its leftmost entry, which any caller can forge, so an attacker
  // could choose the address recorded against their own failed logins
  // (habitcraft-jxo).
  return req.ip ?? null;
}

function logSecurityEvent(event, req, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip: getClientIp(req),
    userAgent: req.get('user-agent') || null,
    ...details,
  };

  // Include path for auth failure events
  if (event === SECURITY_EVENTS.AUTH_FAILURE && req.path) {
    logEntry.path = req.path;
  }

  console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
}

module.exports = {
  logSecurityEvent,
  SECURITY_EVENTS,
};
