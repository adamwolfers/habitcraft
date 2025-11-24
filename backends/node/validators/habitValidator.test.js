const { validateHabitInput } = require('./habitValidator');

describe('Habit Validator Middleware', () => {
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

  describe('Valid inputs', () => {
    it('should call next() with valid habit input', () => {
      mockReq.body = {
        name: 'Exercise',
        frequency: 'daily'
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() with all valid optional fields', () => {
      mockReq.body = {
        name: 'Exercise',
        frequency: 'daily',
        description: 'Daily workout routine',
        color: '#FF5733',
        icon: '🏃',
        status: 'active',
        targetDays: [1, 3, 5]
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Name validation', () => {
    it('should return 400 if name is missing', () => {
      mockReq.body = {
        frequency: 'daily'
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error'
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 400 if name is empty string', () => {
      mockReq.body = {
        name: '   ',
        frequency: 'daily'
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 400 if name exceeds max length', () => {
      mockReq.body = {
        name: 'a'.repeat(101),
        frequency: 'daily'
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('must not exceed 100 characters')
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('Frequency validation', () => {
    it('should return 400 if frequency is missing', () => {
      mockReq.body = {
        name: 'Exercise'
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 400 if frequency is invalid', () => {
      mockReq.body = {
        name: 'Exercise',
        frequency: 'invalid'
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('must be one of: daily, weekly, custom')
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('Description validation', () => {
    it('should return 400 if description exceeds max length', () => {
      mockReq.body = {
        name: 'Exercise',
        frequency: 'daily',
        description: 'a'.repeat(501)
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('must not exceed 500 characters')
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('TargetDays validation', () => {
    it('should return 400 if targetDays is not an array', () => {
      mockReq.body = {
        name: 'Exercise',
        frequency: 'daily',
        targetDays: 'not-an-array'
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('targetDays must be an array')
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 400 if targetDays contains invalid values', () => {
      mockReq.body = {
        name: 'Exercise',
        frequency: 'daily',
        targetDays: [0, 1, 7]
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('must contain integers between 0 and 6')
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('Color validation', () => {
    it('should return 400 if color is not a valid hex color', () => {
      mockReq.body = {
        name: 'Exercise',
        frequency: 'daily',
        color: 'not-a-color'
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('must be a valid hex color code')
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('Icon validation', () => {
    it('should return 400 if icon is not a string', () => {
      mockReq.body = {
        name: 'Exercise',
        frequency: 'daily',
        icon: 123
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('icon must be a string')
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('Status validation', () => {
    it('should return 400 if status is invalid', () => {
      mockReq.body = {
        name: 'Exercise',
        frequency: 'daily',
        status: 'invalid-status'
      };

      validateHabitInput(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('must be one of: active, archived')
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });
});
