import { validateEmail, isValidProfileForm } from './validationUtils';

describe('validationUtils', () => {
  describe('validateEmail', () => {
    it('should return true for valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
    });

    it('should return true for email with subdomain', () => {
      expect(validateEmail('user@mail.example.com')).toBe(true);
    });

    it('should return true for email with plus sign', () => {
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should return true for email with dots in local part', () => {
      expect(validateEmail('first.last@example.com')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(validateEmail('')).toBe(false);
    });

    it('should return false for email without @ symbol', () => {
      expect(validateEmail('testexample.com')).toBe(false);
    });

    it('should return false for email without domain', () => {
      expect(validateEmail('test@')).toBe(false);
    });

    it('should return false for email without local part', () => {
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('should return false for email with spaces', () => {
      expect(validateEmail('test @example.com')).toBe(false);
    });

    it('should return false for email without TLD', () => {
      expect(validateEmail('test@example')).toBe(false);
    });
  });

  describe('isValidProfileForm', () => {
    it('should return true for valid name and email', () => {
      expect(isValidProfileForm('John Doe', 'john@example.com')).toBe(true);
    });

    it('should return false for empty name', () => {
      expect(isValidProfileForm('', 'john@example.com')).toBe(false);
    });

    it('should return false for whitespace-only name', () => {
      expect(isValidProfileForm('   ', 'john@example.com')).toBe(false);
    });

    it('should return false for empty email', () => {
      expect(isValidProfileForm('John Doe', '')).toBe(false);
    });

    it('should return false for whitespace-only email', () => {
      expect(isValidProfileForm('John Doe', '   ')).toBe(false);
    });

    it('should return false for invalid email', () => {
      expect(isValidProfileForm('John Doe', 'invalid-email')).toBe(false);
    });

    it('should trim name and email before validation', () => {
      expect(isValidProfileForm('  John Doe  ', '  john@example.com  ')).toBe(true);
    });

    it('should return false when both name and email are invalid', () => {
      expect(isValidProfileForm('', 'invalid')).toBe(false);
    });
  });
});
