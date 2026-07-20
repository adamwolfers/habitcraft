import { validateRegistrationForm, validatePasswordChange } from './authUtils';

describe('validateRegistrationForm', () => {
  describe('password length validation', () => {
    it('returns error when password is less than 8 characters', () => {
      const result = validateRegistrationForm({
        password: 'short',
        confirmPassword: 'short',
      });
      expect(result).toBe('Password must be at least 8 characters');
    });

    it('returns error when password is exactly 7 characters', () => {
      const result = validateRegistrationForm({
        password: '1234567',
        confirmPassword: '1234567',
      });
      expect(result).toBe('Password must be at least 8 characters');
    });

    it('accepts password with exactly 8 characters', () => {
      const result = validateRegistrationForm({
        password: '12345678',
        confirmPassword: '12345678',
      });
      expect(result).toBeNull();
    });

    it('returns error when password exceeds 72 characters', () => {
      const longPassword = 'a'.repeat(73);
      const result = validateRegistrationForm({
        password: longPassword,
        confirmPassword: longPassword,
      });
      expect(result).toBe('Password must be 72 characters or less');
    });

    it('accepts password with exactly 72 characters', () => {
      const maxPassword = 'a'.repeat(72);
      const result = validateRegistrationForm({
        password: maxPassword,
        confirmPassword: maxPassword,
      });
      expect(result).toBeNull();
    });
  });

  describe('password match validation', () => {
    it('returns error when passwords do not match', () => {
      const result = validateRegistrationForm({
        password: 'validpassword123',
        confirmPassword: 'differentpassword',
      });
      expect(result).toBe('Passwords do not match');
    });

    it('accepts when passwords match', () => {
      const result = validateRegistrationForm({
        password: 'validpassword123',
        confirmPassword: 'validpassword123',
      });
      expect(result).toBeNull();
    });
  });

  describe('email length validation', () => {
    it('returns error when email exceeds 255 characters', () => {
      const longEmail = 'a'.repeat(244) + '@example.com';
      const result = validateRegistrationForm({
        email: longEmail,
        password: 'validpass123',
        confirmPassword: 'validpass123',
      });
      expect(result).toBe('Email must be 255 characters or less');
    });

    it('accepts email with exactly 255 characters', () => {
      const email = 'a'.repeat(243) + '@example.com'; // 255 chars
      const result = validateRegistrationForm({
        email,
        password: 'validpass123',
        confirmPassword: 'validpass123',
      });
      expect(result).toBeNull();
    });
  });

  describe('name length validation', () => {
    it('returns error when name exceeds 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = validateRegistrationForm({
        name: longName,
        password: 'validpass123',
        confirmPassword: 'validpass123',
      });
      expect(result).toBe('Name must be 100 characters or less');
    });

    it('accepts name with exactly 100 characters', () => {
      const name = 'a'.repeat(100);
      const result = validateRegistrationForm({
        name,
        password: 'validpass123',
        confirmPassword: 'validpass123',
      });
      expect(result).toBeNull();
    });
  });

  describe('validation order', () => {
    it('checks email length before name length', () => {
      const result = validateRegistrationForm({
        email: 'a'.repeat(256) + '@test.com',
        name: 'a'.repeat(101),
        password: 'validpass123',
        confirmPassword: 'validpass123',
      });
      expect(result).toBe('Email must be 255 characters or less');
    });

    it('checks name length before password length', () => {
      const result = validateRegistrationForm({
        name: 'a'.repeat(101),
        password: 'short',
        confirmPassword: 'short',
      });
      expect(result).toBe('Name must be 100 characters or less');
    });

    it('checks password length before password match', () => {
      // Both validations fail, but length should be checked first
      const result = validateRegistrationForm({
        password: 'short',
        confirmPassword: 'different',
      });
      expect(result).toBe('Password must be at least 8 characters');
    });
  });
});

describe('validatePasswordChange', () => {
  describe('current password validation', () => {
    it('returns error when current password is empty', () => {
      const result = validatePasswordChange({
        currentPassword: '',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      });
      expect(result).toBe('Current password is required');
    });
  });

  describe('new password length validation', () => {
    it('returns error when new password is less than 8 characters', () => {
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: 'short',
        confirmPassword: 'short',
      });
      expect(result).toBe('New password must be at least 8 characters');
    });

    it('returns error when new password is exactly 7 characters', () => {
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: '1234567',
        confirmPassword: '1234567',
      });
      expect(result).toBe('New password must be at least 8 characters');
    });

    it('accepts new password with exactly 8 characters', () => {
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: '12345678',
        confirmPassword: '12345678',
      });
      expect(result).toBeNull();
    });

    it('returns error when new password exceeds 72 characters', () => {
      const longPassword = 'a'.repeat(73);
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: longPassword,
        confirmPassword: longPassword,
      });
      expect(result).toBe('New password must be 72 characters or less');
    });

    it('accepts new password with exactly 72 characters', () => {
      const maxPassword = 'a'.repeat(72);
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: maxPassword,
        confirmPassword: maxPassword,
      });
      expect(result).toBeNull();
    });
  });

  describe('password match validation', () => {
    it('returns error when passwords do not match', () => {
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: 'validpassword123',
        confirmPassword: 'differentpassword',
      });
      expect(result).toBe('Passwords do not match');
    });

    it('accepts when passwords match', () => {
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: 'validpassword123',
        confirmPassword: 'validpassword123',
      });
      expect(result).toBeNull();
    });
  });

  describe('validation order', () => {
    it('checks current password before new password length', () => {
      const result = validatePasswordChange({
        currentPassword: '',
        newPassword: 'short',
        confirmPassword: 'short',
      });
      expect(result).toBe('Current password is required');
    });

    it('checks new password length before password match', () => {
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: 'short',
        confirmPassword: 'different',
      });
      expect(result).toBe('New password must be at least 8 characters');
    });
  });

  describe('valid input', () => {
    it('returns null for valid password change data', () => {
      const result = validatePasswordChange({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword456',
        confirmPassword: 'newpassword456',
      });
      expect(result).toBeNull();
    });
  });
});
