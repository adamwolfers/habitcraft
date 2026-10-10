import {
  validateRegisterForm,
  validateLoginForm,
  validateProfileForm,
  validatePasswordChangeForm,
  getProfileChanges,
  isValidEmail,
  hasErrors,
  NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_EMAIL_MAX_LENGTH,
  NEW_PASSWORD_MIN_LENGTH,
  NEW_PASSWORD_MAX_LENGTH,
} from './authUtils';
import { requestLimits } from '@/types/apiLimits.generated';

const validRegistration = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
};

/** A syntactically valid address of exactly `length` characters. */
function emailOfLength(length: number): string {
  const suffix = '@example.com';
  return 'a'.repeat(length - suffix.length) + suffix;
}

describe('isValidEmail', () => {
  it.each(['test@example.com', 'a.b+c@sub.domain.co.uk'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'nope', 'no@domain', 'no domain@example.com', '@example.com'])(
    'rejects %p',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    }
  );
});

describe('validateRegisterForm', () => {
  it('returns no errors for a valid form', () => {
    expect(validateRegisterForm(validRegistration)).toEqual({});
  });

  describe('name', () => {
    it('requires a name -- users.name is NOT NULL server-side', () => {
      expect(validateRegisterForm({ ...validRegistration, name: '' }).name).toBe(
        'Name is required'
      );
    });

    it('rejects a name that is only whitespace', () => {
      expect(validateRegisterForm({ ...validRegistration, name: '   ' }).name).toBe(
        'Name is required'
      );
    });

    it("rejects a name past the spec's maximum", () => {
      const errors = validateRegisterForm({
        ...validRegistration,
        name: 'a'.repeat(NAME_MAX_LENGTH + 1),
      });
      expect(errors.name).toBe(`Name must be ${NAME_MAX_LENGTH} characters or less`);
    });

    it("accepts a name at exactly the spec's maximum", () => {
      const errors = validateRegisterForm({
        ...validRegistration,
        name: 'a'.repeat(NAME_MAX_LENGTH),
      });
      expect(errors.name).toBeUndefined();
    });

    it('measures the trimmed name, matching what gets sent', () => {
      const errors = validateRegisterForm({
        ...validRegistration,
        name: `  ${'a'.repeat(NAME_MAX_LENGTH)}  `,
      });
      expect(errors.name).toBeUndefined();
    });
  });

  describe('email', () => {
    it('requires an email', () => {
      expect(validateRegisterForm({ ...validRegistration, email: '' }).email).toBe(
        'Email is required'
      );
    });

    it('rejects a malformed email', () => {
      expect(validateRegisterForm({ ...validRegistration, email: 'nope' }).email).toBe(
        'Please enter a valid email'
      );
    });

    it("rejects a well-formed email past the spec's maximum", () => {
      const errors = validateRegisterForm({
        ...validRegistration,
        email: emailOfLength(EMAIL_MAX_LENGTH + 1),
      });
      expect(errors.email).toBe(`Email must be ${EMAIL_MAX_LENGTH} characters or less`);
    });

    it("accepts an email at exactly the spec's maximum", () => {
      const errors = validateRegisterForm({
        ...validRegistration,
        email: emailOfLength(EMAIL_MAX_LENGTH),
      });
      expect(errors.email).toBeUndefined();
    });
  });

  describe('password', () => {
    it('requires a password', () => {
      expect(validateRegisterForm({ ...validRegistration, password: '' }).password).toBe(
        'Password is required'
      );
    });

    it("rejects a password below the spec's minimum", () => {
      const errors = validateRegisterForm({
        ...validRegistration,
        password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
      });
      expect(errors.password).toBe(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    });

    it("accepts a password at exactly the spec's minimum", () => {
      const errors = validateRegisterForm({
        ...validRegistration,
        password: 'a'.repeat(PASSWORD_MIN_LENGTH),
      });
      expect(errors.password).toBeUndefined();
    });

    it("rejects a password past the spec's maximum", () => {
      const errors = validateRegisterForm({
        ...validRegistration,
        password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
      });
      expect(errors.password).toBe(`Password must be ${PASSWORD_MAX_LENGTH} characters or less`);
    });

    it('does not trim the password -- whitespace is a legitimate character', () => {
      const errors = validateRegisterForm({
        ...validRegistration,
        password: ' '.repeat(PASSWORD_MIN_LENGTH),
      });
      expect(errors.password).toBeUndefined();
    });
  });

  it('reports every failure at once rather than stopping at the first', () => {
    // This is the whole point of returning a map: the screen used to
    // short-circuit, costing the user one submit per mistake.
    expect(validateRegisterForm({ name: '', email: 'nope', password: 'short' })).toEqual({
      name: 'Name is required',
      email: 'Please enter a valid email',
      password: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    });
  });
});

describe('validateLoginForm', () => {
  const validLogin = { email: 'test@example.com', password: 'password123' };

  it('returns no errors for a valid form', () => {
    expect(validateLoginForm(validLogin)).toEqual({});
  });

  it('requires an email', () => {
    expect(validateLoginForm({ ...validLogin, email: '' }).email).toBe('Email is required');
  });

  it('rejects a malformed email', () => {
    expect(validateLoginForm({ ...validLogin, email: 'nope' }).email).toBe(
      'Please enter a valid email'
    );
  });

  it('requires a password', () => {
    expect(validateLoginForm({ ...validLogin, password: '' }).password).toBe(
      'Password is required'
    );
  });

  it('does not apply the sign-up length limits', () => {
    // A credential predating a limit change must still be usable to log in.
    expect(
      validateLoginForm({
        email: emailOfLength(EMAIL_MAX_LENGTH + 1),
        password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
      })
    ).toEqual({});
  });

  it('reports both failures at once', () => {
    expect(validateLoginForm({ email: '', password: '' })).toEqual({
      email: 'Email is required',
      password: 'Password is required',
    });
  });
});

describe('validateProfileForm', () => {
  const validProfile = { name: 'Test User', email: 'test@example.com' };

  it('returns no errors for a valid profile', () => {
    expect(validateProfileForm(validProfile)).toEqual({});
  });

  it('requires a name', () => {
    expect(validateProfileForm({ ...validProfile, name: '   ' })).toEqual({
      name: 'Name is required',
    });
  });

  it('accepts a name at the limit and rejects one past it', () => {
    const atLimit = 'a'.repeat(PROFILE_NAME_MAX_LENGTH);
    expect(validateProfileForm({ ...validProfile, name: atLimit })).toEqual({});
    expect(validateProfileForm({ ...validProfile, name: `${atLimit}a` })).toEqual({
      name: `Name must be ${PROFILE_NAME_MAX_LENGTH} characters or less`,
    });
  });

  it('requires a well-formed email', () => {
    expect(validateProfileForm({ ...validProfile, email: '' }).email).toBe('Email is required');
    expect(validateProfileForm({ ...validProfile, email: 'nope' }).email).toBe(
      'Please enter a valid email'
    );
  });

  it('accepts an email at the limit and rejects one past it', () => {
    expect(
      validateProfileForm({ ...validProfile, email: emailOfLength(PROFILE_EMAIL_MAX_LENGTH) })
    ).toEqual({});
    expect(
      validateProfileForm({ ...validProfile, email: emailOfLength(PROFILE_EMAIL_MAX_LENGTH + 1) })
    ).toEqual({ email: `Email must be ${PROFILE_EMAIL_MAX_LENGTH} characters or less` });
  });

  it('reports every failure at once', () => {
    expect(validateProfileForm({ name: '', email: '' })).toEqual({
      name: 'Name is required',
      email: 'Email is required',
    });
  });
});

describe('getProfileChanges', () => {
  const user = { name: 'Test User', email: 'test@example.com' };

  it('returns nothing when neither field changed', () => {
    expect(getProfileChanges(user, { name: 'Test User', email: 'test@example.com' })).toEqual({});
  });

  it('ignores surrounding whitespace', () => {
    expect(getProfileChanges(user, { name: ' Test User ', email: ' test@example.com ' })).toEqual(
      {}
    );
  });

  it('treats a case-only email edit as unchanged, since the server lowercases it', () => {
    expect(getProfileChanges(user, { name: 'Test User', email: 'Test@Example.com' })).toEqual({});
  });

  it('returns only the trimmed fields that changed', () => {
    expect(getProfileChanges(user, { name: ' New Name ', email: 'test@example.com' })).toEqual({
      name: 'New Name',
    });
    expect(getProfileChanges(user, { name: 'Test User', email: ' new@example.com ' })).toEqual({
      email: 'new@example.com',
    });
  });
});

describe('validatePasswordChangeForm', () => {
  const newPassword = 'n'.repeat(NEW_PASSWORD_MIN_LENGTH);
  const valid = { currentPassword: 'old-password', newPassword, confirmPassword: newPassword };

  it('takes its limits from the change-password request, not sign-up', () => {
    expect(NEW_PASSWORD_MIN_LENGTH).toBe(requestLimits.changePassword.newPassword.minLength);
    expect(NEW_PASSWORD_MAX_LENGTH).toBe(requestLimits.changePassword.newPassword.maxLength);
  });

  it('accepts a valid change', () => {
    expect(validatePasswordChangeForm(valid)).toEqual({});
  });

  it('requires the current password', () => {
    expect(validatePasswordChangeForm({ ...valid, currentPassword: '' })).toEqual({
      currentPassword: 'Current password is required',
    });
  });

  it('enforces the new password length limits', () => {
    const short = 'n'.repeat(NEW_PASSWORD_MIN_LENGTH - 1);
    expect(
      validatePasswordChangeForm({ ...valid, newPassword: short, confirmPassword: short })
    ).toEqual({
      newPassword: `New password must be at least ${NEW_PASSWORD_MIN_LENGTH} characters`,
    });

    const atMax = 'n'.repeat(NEW_PASSWORD_MAX_LENGTH);
    expect(
      validatePasswordChangeForm({ ...valid, newPassword: atMax, confirmPassword: atMax })
    ).toEqual({});

    const long = `${atMax}n`;
    expect(
      validatePasswordChangeForm({ ...valid, newPassword: long, confirmPassword: long })
    ).toEqual({
      newPassword: `New password must be ${NEW_PASSWORD_MAX_LENGTH} characters or less`,
    });
  });

  it('requires the confirmation to match the new password', () => {
    expect(validatePasswordChangeForm({ ...valid, confirmPassword: `${newPassword}x` })).toEqual({
      confirmPassword: 'Passwords do not match',
    });
  });

  it('reports every failure at once', () => {
    expect(
      validatePasswordChangeForm({ currentPassword: '', newPassword: '', confirmPassword: 'x' })
    ).toEqual({
      currentPassword: 'Current password is required',
      newPassword: `New password must be at least ${NEW_PASSWORD_MIN_LENGTH} characters`,
      confirmPassword: 'Passwords do not match',
    });
  });
});

describe('hasErrors', () => {
  it('is false for an empty map', () => {
    expect(hasErrors({})).toBe(false);
  });

  it('is true when any field failed', () => {
    expect(hasErrors({ email: 'Email is required' })).toBe(true);
  });

  it('is false when a cleared field left an undefined behind', () => {
    // Clearing one field's error writes `undefined` over it rather than
    // deleting the key, so counting keys would report a stale failure.
    expect(hasErrors({ email: undefined, password: undefined })).toBe(false);
  });

  it('is true when one field is cleared but another still failed', () => {
    expect(hasErrors({ email: undefined, password: 'Password is required' })).toBe(true);
  });
});
