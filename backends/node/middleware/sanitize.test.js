const { sanitizeBody, sanitizeEmail } = require('./sanitize');

describe('Sanitize Middleware', () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFn = jest.fn();
  });

  describe('sanitizeBody', () => {
    describe('XSS prevention', () => {
      it('should strip script tags from string fields', () => {
        mockReq.body = {
          name: '<script>alert("xss")</script>Exercise',
          description: 'My <script>evil()</script> workout'
        };

        sanitizeBody(mockReq, mockRes, nextFn);

        expect(mockReq.body.name).toBe('Exercise');
        expect(mockReq.body.description).toBe('My  workout');
        expect(nextFn).toHaveBeenCalled();
      });

      it('should strip HTML tags from string fields', () => {
        mockReq.body = {
          name: '<b>Bold</b> Name',
          description: '<a href="evil.com">Click me</a>'
        };

        sanitizeBody(mockReq, mockRes, nextFn);

        expect(mockReq.body.name).toBe('Bold Name');
        expect(mockReq.body.description).toBe('Click me');
        expect(nextFn).toHaveBeenCalled();
      });

      it('should handle onerror and other event handlers', () => {
        mockReq.body = {
          name: '<img src=x onerror="alert(1)">Test'
        };

        sanitizeBody(mockReq, mockRes, nextFn);

        expect(mockReq.body.name).not.toContain('onerror');
        expect(mockReq.body.name).toContain('Test');
        expect(nextFn).toHaveBeenCalled();
      });

      it('should handle javascript: URLs', () => {
        mockReq.body = {
          description: '<a href="javascript:alert(1)">Click</a>'
        };

        sanitizeBody(mockReq, mockRes, nextFn);

        expect(mockReq.body.description).not.toContain('javascript:');
        expect(nextFn).toHaveBeenCalled();
      });
    });

    describe('Whitespace trimming', () => {
      it('should trim leading and trailing whitespace from strings', () => {
        mockReq.body = {
          name: '  Exercise  ',
          description: '\t\nDescription with spaces\n\t'
        };

        sanitizeBody(mockReq, mockRes, nextFn);

        expect(mockReq.body.name).toBe('Exercise');
        expect(mockReq.body.description).toBe('Description with spaces');
        expect(nextFn).toHaveBeenCalled();
      });
    });

    describe('Non-string fields', () => {
      it('should not modify non-string fields', () => {
        mockReq.body = {
          name: 'Exercise',
          targetDays: [0, 1, 2],
          count: 5,
          active: true
        };

        sanitizeBody(mockReq, mockRes, nextFn);

        expect(mockReq.body.targetDays).toEqual([0, 1, 2]);
        expect(mockReq.body.count).toBe(5);
        expect(mockReq.body.active).toBe(true);
        expect(nextFn).toHaveBeenCalled();
      });

      it('should handle null and undefined values', () => {
        mockReq.body = {
          name: 'Test',
          description: null,
          notes: undefined
        };

        sanitizeBody(mockReq, mockRes, nextFn);

        expect(mockReq.body.name).toBe('Test');
        expect(mockReq.body.description).toBeNull();
        expect(mockReq.body.notes).toBeUndefined();
        expect(nextFn).toHaveBeenCalled();
      });
    });

    describe('Edge cases', () => {
      it('should handle empty body', () => {
        mockReq.body = {};

        sanitizeBody(mockReq, mockRes, nextFn);

        expect(mockReq.body).toEqual({});
        expect(nextFn).toHaveBeenCalled();
      });

      it('should handle nested objects', () => {
        mockReq.body = {
          name: '<script>bad</script>Test',
          nested: {
            value: '<b>nested</b>'
          }
        };

        sanitizeBody(mockReq, mockRes, nextFn);

        // Top level should be sanitized
        expect(mockReq.body.name).toBe('Test');
        // Nested objects are preserved (only top-level strings sanitized)
        expect(mockReq.body.nested).toEqual({ value: '<b>nested</b>' });
        expect(nextFn).toHaveBeenCalled();
      });

      it('should preserve emojis', () => {
        mockReq.body = {
          name: '🏃 Running',
          icon: '⭐'
        };

        sanitizeBody(mockReq, mockRes, nextFn);

        expect(mockReq.body.name).toBe('🏃 Running');
        expect(mockReq.body.icon).toBe('⭐');
        expect(nextFn).toHaveBeenCalled();
      });
    });
  });

  describe('sanitizeEmail', () => {
    it('should trim whitespace from email', () => {
      mockReq.body = {
        email: '  user@example.com  '
      };

      sanitizeEmail(mockReq, mockRes, nextFn);

      expect(mockReq.body.email).toBe('user@example.com');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should convert email to lowercase', () => {
      mockReq.body = {
        email: 'User@Example.COM'
      };

      sanitizeEmail(mockReq, mockRes, nextFn);

      expect(mockReq.body.email).toBe('user@example.com');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should handle both trim and lowercase together', () => {
      mockReq.body = {
        email: '  USER@EXAMPLE.COM  '
      };

      sanitizeEmail(mockReq, mockRes, nextFn);

      expect(mockReq.body.email).toBe('user@example.com');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should handle missing email gracefully', () => {
      mockReq.body = {
        name: 'John'
      };

      sanitizeEmail(mockReq, mockRes, nextFn);

      expect(mockReq.body.email).toBeUndefined();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should handle null email', () => {
      mockReq.body = {
        email: null
      };

      sanitizeEmail(mockReq, mockRes, nextFn);

      expect(mockReq.body.email).toBeNull();
      expect(nextFn).toHaveBeenCalled();
    });
  });
});
