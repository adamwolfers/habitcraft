const { logSecurityEvent, SECURITY_EVENTS } = require('./securityLogger');

describe('Security Logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // Helper to extract JSON from log output
  function parseLogOutput(logCall) {
    const output = logCall[0];
    const jsonPart = output.replace(/^\[SECURITY\] /, '');
    return JSON.parse(jsonPart);
  }

  describe('SECURITY_EVENTS', () => {
    it('should export all security event types', () => {
      expect(SECURITY_EVENTS.LOGIN_SUCCESS).toBe('LOGIN_SUCCESS');
      expect(SECURITY_EVENTS.LOGIN_FAILURE).toBe('LOGIN_FAILURE');
      expect(SECURITY_EVENTS.REGISTER_SUCCESS).toBe('REGISTER_SUCCESS');
      expect(SECURITY_EVENTS.TOKEN_REFRESH_SUCCESS).toBe('TOKEN_REFRESH_SUCCESS');
      expect(SECURITY_EVENTS.TOKEN_REFRESH_FAILURE).toBe('TOKEN_REFRESH_FAILURE');
      expect(SECURITY_EVENTS.LOGOUT).toBe('LOGOUT');
      expect(SECURITY_EVENTS.AUTH_FAILURE).toBe('AUTH_FAILURE');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log event with timestamp', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'user-agent') return 'Mozilla/5.0';
          return null;
        })
      };

      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, mockReq, { email: 'test@example.com' });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const loggedData = parseLogOutput(consoleSpy.mock.calls[0]);
      expect(loggedData.timestamp).toBeDefined();
      expect(new Date(loggedData.timestamp)).toBeInstanceOf(Date);
    });

    it('should log event type', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'user-agent') return 'Mozilla/5.0';
          return null;
        })
      };

      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILURE, mockReq, { email: 'test@example.com' });

      const loggedData = parseLogOutput(consoleSpy.mock.calls[0]);
      expect(loggedData.event).toBe('LOGIN_FAILURE');
    });

    it('should log IP address from request', () => {
      const mockReq = {
        ip: '192.168.1.100',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'user-agent') return 'Mozilla/5.0';
          return null; // No x-forwarded-for
        })
      };

      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, mockReq, { email: 'test@example.com' });

      const loggedData = parseLogOutput(consoleSpy.mock.calls[0]);
      expect(loggedData.ip).toBe('192.168.1.100');
    });

    it('should log user agent from request headers', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'user-agent') return 'TestBrowser/1.0';
          return null;
        })
      };

      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, mockReq, { email: 'test@example.com' });

      const loggedData = parseLogOutput(consoleSpy.mock.calls[0]);
      expect(loggedData.userAgent).toBe('TestBrowser/1.0');
      expect(mockReq.get).toHaveBeenCalledWith('user-agent');
    });

    it('should log email when provided', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'user-agent') return 'Mozilla/5.0';
          return null;
        })
      };

      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, mockReq, { email: 'user@example.com' });

      const loggedData = parseLogOutput(consoleSpy.mock.calls[0]);
      expect(loggedData.email).toBe('user@example.com');
    });

    it('should log userId when provided', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'user-agent') return 'Mozilla/5.0';
          return null;
        })
      };

      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, mockReq, {
        email: 'user@example.com',
        userId: '12345-uuid'
      });

      const loggedData = parseLogOutput(consoleSpy.mock.calls[0]);
      expect(loggedData.userId).toBe('12345-uuid');
    });

    it('should log reason when provided', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'user-agent') return 'Mozilla/5.0';
          return null;
        })
      };

      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILURE, mockReq, {
        email: 'user@example.com',
        reason: 'invalid_password'
      });

      const loggedData = parseLogOutput(consoleSpy.mock.calls[0]);
      expect(loggedData.reason).toBe('invalid_password');
    });

    it('should handle missing user agent gracefully', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue(null) // All headers return null
      };

      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, mockReq, { email: 'test@example.com' });

      const loggedData = parseLogOutput(consoleSpy.mock.calls[0]);
      expect(loggedData.userAgent).toBeNull();
    });

    it('should handle x-forwarded-for header for proxied requests', () => {
      const mockReq = {
        ip: '10.0.0.1',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'x-forwarded-for') return '203.0.113.195, 70.41.3.18';
          if (header === 'user-agent') return 'Mozilla/5.0';
          return null;
        })
      };

      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, mockReq, { email: 'test@example.com' });

      const loggedData = parseLogOutput(consoleSpy.mock.calls[0]);
      // Should use first IP from x-forwarded-for
      expect(loggedData.ip).toBe('203.0.113.195');
    });

    it('should log AUTH_FAILURE events with path', () => {
      const mockReq = {
        ip: '127.0.0.1',
        path: '/api/v1/habits',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'user-agent') return 'Mozilla/5.0';
          return null;
        })
      };

      logSecurityEvent(SECURITY_EVENTS.AUTH_FAILURE, mockReq, {
        reason: 'token_expired'
      });

      const loggedData = parseLogOutput(consoleSpy.mock.calls[0]);
      expect(loggedData.event).toBe('AUTH_FAILURE');
      expect(loggedData.path).toBe('/api/v1/habits');
      expect(loggedData.reason).toBe('token_expired');
    });

    it('should prefix log with [SECURITY] for easy filtering', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'user-agent') return 'Mozilla/5.0';
          return null;
        })
      };

      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, mockReq, { email: 'test@example.com' });

      expect(consoleSpy.mock.calls[0][0]).toMatch(/^\[SECURITY\]/);
    });
  });
});
