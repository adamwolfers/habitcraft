import { requestLimits } from '@/types/apiLimits.generated';

/**
 * From the spec, not literals (habitcraft-467). The server validates the same
 * numbers, so a literal that drifts below them just moves the rejection from
 * the form to a 400 the user cannot act on (habitcraft-h7q7).
 */
export const NAME_MAX_LENGTH = requestLimits.register.name.maxLength;
export const EMAIL_MAX_LENGTH = requestLimits.register.email.maxLength;
export const PASSWORD_MIN_LENGTH = requestLimits.register.password.minLength;
export const PASSWORD_MAX_LENGTH = requestLimits.register.password.maxLength;

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export type RegisterField = 'name' | 'email' | 'password';
export type LoginField = 'email' | 'password';

export type RegisterFieldErrors = Partial<Record<RegisterField, string>>;
export type LoginFieldErrors = Partial<Record<LoginField, string>>;

export interface RegisterFormValues {
  name: string;
  email: string;
  password: string;
}

export interface LoginFormValues {
  email: string;
  password: string;
}

function validateEmailFormat(email: string): string | undefined {
  if (!email.trim()) {
    return 'Email is required';
  }
  if (!isValidEmail(email.trim())) {
    return 'Please enter a valid email';
  }
  return undefined;
}

/**
 * Validates the sign-up form, reporting EVERY failure rather than stopping at
 * the first. The screens used to short-circuit, which cost a user one submit
 * per mistake; returning a map lets each message sit under its own field.
 */
export function validateRegisterForm(values: RegisterFormValues): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};

  // The server requires a name -- users.name is NOT NULL, so a body without one
  // comes back 400 (habitcraft-7ggs).
  if (!values.name.trim()) {
    errors.name = 'Name is required';
  } else if (values.name.trim().length > NAME_MAX_LENGTH) {
    errors.name = `Name must be ${NAME_MAX_LENGTH} characters or less`;
  }

  const emailError = validateEmailFormat(values.email);
  if (emailError) {
    errors.email = emailError;
  } else if (values.email.trim().length > EMAIL_MAX_LENGTH) {
    errors.email = `Email must be ${EMAIL_MAX_LENGTH} characters or less`;
  }

  if (!values.password) {
    errors.password = 'Password is required';
  } else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  } else if (values.password.length > PASSWORD_MAX_LENGTH) {
    // Capped here rather than truncated with maxLength on the input: silently
    // trimming a pasted passphrase would leave the account with a password the
    // user cannot type back into the login screen.
    errors.password = `Password must be ${PASSWORD_MAX_LENGTH} characters or less`;
  }

  return errors;
}

/**
 * Validates the log-in form. Deliberately looser than the sign-up rules.
 */
export function validateLoginForm(values: LoginFormValues): LoginFieldErrors {
  const errors: LoginFieldErrors = {};

  // Presence and format only -- no length cap. The limits belong to account
  // creation, and enforcing them here would lock out anyone holding a
  // credential from before a limit changed.
  const emailError = validateEmailFormat(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  if (!values.password) {
    errors.password = 'Password is required';
  }

  return errors;
}

/**
 * Counts values, not keys: clearing one field's error writes `undefined` over
 * it rather than deleting it, so a key-count would report a failure that is no
 * longer there.
 */
export function hasErrors(errors: RegisterFieldErrors | LoginFieldErrors): boolean {
  return Object.values(errors).some((message) => message !== undefined);
}
