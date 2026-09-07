import {
  validateRegisterForm,
  validateLoginForm,
  isValidEmail,
  hasErrors,
  NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from './authUtils';

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

describe('hasErrors', () => {
  it('is false for an empty map', () => {
    expect(hasErrors({})).toBe(false);
  });

  it('is true when any field failed', () => {
    expect(hasErrors({ email: 'Email is required' })).toBe(true);
  });
});
