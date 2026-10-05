import { validateRegistrationForm, validatePasswordChange } from './authUtils';
import { requestLimits } from '@/types/apiLimits.generated';

// Every boundary comes from the spec, never a literal (habitcraft-psq1): a
// test that restates the number keeps passing after the spec moves on.
const { email: EMAIL, name: NAME, password: PASSWORD } = requestLimits.register;
const NEW_PASSWORD = requestLimits.changePassword.newPassword;

const EMAIL_DOMAIN = '@example.com';
const emailOfLength = (length: number) => 'a'.repeat(length - EMAIL_DOMAIN.length) + EMAIL_DOMAIN;

const tooShortPassword = 'a'.repeat(PASSWORD.minLength - 1);
const tooShortNewPassword = 'a'.repeat(NEW_PASSWORD.minLength - 1);

describe('validateRegistrationForm', () => {
  describe('password length validation', () => {
    it('returns error when password is one character below the minimum', () => {
      const result = validateRegistrationForm({
        password: tooShortPassword,
        confirmPassword: tooShortPassword,
      });
      expect(result).toBe(`Password must be at least ${PASSWORD.minLength} characters`);
    });

    it('accepts password at exactly the minimum length', () => {
      const minPassword = 'a'.repeat(PASSWORD.minLength);
      const result = validateRegistrationForm({
        password: minPassword,
        confirmPassword: minPassword,
      });
      expect(result).toBeNull();
    });

    it('returns error when password exceeds the maximum length', () => {
      const longPassword = 'a'.repeat(PASSWORD.maxLength + 1);
      const result = validateRegistrationForm({
        password: longPassword,
        confirmPassword: longPassword,
      });
      expect(result).toBe(`Password must be ${PASSWORD.maxLength} characters or less`);
    });

    it('accepts password at exactly the maximum length', () => {
      const maxPassword = 'a'.repeat(PASSWORD.maxLength);
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
    it('returns error when email exceeds the maximum length', () => {
      const longEmail = emailOfLength(EMAIL.maxLength + 1);
      const result = validateRegistrationForm({
        email: longEmail,
        password: 'validpass123',
        confirmPassword: 'validpass123',
      });
      expect(result).toBe(`Email must be ${EMAIL.maxLength} characters or less`);
    });

    it('accepts email at exactly the maximum length', () => {
      const email = emailOfLength(EMAIL.maxLength);
      const result = validateRegistrationForm({
        email,
        password: 'validpass123',
        confirmPassword: 'validpass123',
      });
      expect(result).toBeNull();
    });
  });

  describe('name length validation', () => {
    it('returns error when name exceeds the maximum length', () => {
      const longName = 'a'.repeat(NAME.maxLength + 1);
      const result = validateRegistrationForm({
        name: longName,
        password: 'validpass123',
        confirmPassword: 'validpass123',
      });
      expect(result).toBe(`Name must be ${NAME.maxLength} characters or less`);
    });

    it('accepts name at exactly the maximum length', () => {
      const name = 'a'.repeat(NAME.maxLength);
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
        email: emailOfLength(EMAIL.maxLength + 1),
        name: 'a'.repeat(NAME.maxLength + 1),
        password: 'validpass123',
        confirmPassword: 'validpass123',
      });
      expect(result).toBe(`Email must be ${EMAIL.maxLength} characters or less`);
    });

    it('checks name length before password length', () => {
      const result = validateRegistrationForm({
        name: 'a'.repeat(NAME.maxLength + 1),
        password: tooShortPassword,
        confirmPassword: tooShortPassword,
      });
      expect(result).toBe(`Name must be ${NAME.maxLength} characters or less`);
    });

    it('checks password length before password match', () => {
      // Both validations fail, but length should be checked first
      const result = validateRegistrationForm({
        password: tooShortPassword,
        confirmPassword: 'different',
      });
      expect(result).toBe(`Password must be at least ${PASSWORD.minLength} characters`);
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
    it('returns error when new password is one character below the minimum', () => {
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: tooShortNewPassword,
        confirmPassword: tooShortNewPassword,
      });
      expect(result).toBe(`New password must be at least ${NEW_PASSWORD.minLength} characters`);
    });

    it('accepts new password at exactly the minimum length', () => {
      const minPassword = 'a'.repeat(NEW_PASSWORD.minLength);
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: minPassword,
        confirmPassword: minPassword,
      });
      expect(result).toBeNull();
    });

    it('returns error when new password exceeds the maximum length', () => {
      const longPassword = 'a'.repeat(NEW_PASSWORD.maxLength + 1);
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: longPassword,
        confirmPassword: longPassword,
      });
      expect(result).toBe(`New password must be ${NEW_PASSWORD.maxLength} characters or less`);
    });

    it('accepts new password at exactly the maximum length', () => {
      const maxPassword = 'a'.repeat(NEW_PASSWORD.maxLength);
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
        newPassword: tooShortNewPassword,
        confirmPassword: tooShortNewPassword,
      });
      expect(result).toBe('Current password is required');
    });

    it('checks new password length before password match', () => {
      const result = validatePasswordChange({
        currentPassword: 'currentpass',
        newPassword: tooShortNewPassword,
        confirmPassword: 'different',
      });
      expect(result).toBe(`New password must be at least ${NEW_PASSWORD.minLength} characters`);
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
