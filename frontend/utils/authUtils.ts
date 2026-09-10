import { requestLimits } from '@/types/apiLimits.generated';

// From the spec, so the browser rejects exactly what the server rejects. These
// four numbers were written out as literals here, again in the backend's
// validators, again in the mobile client and again in openapi.yaml, with
// nothing holding them equal (habitcraft-34d.3).
const REGISTER_LIMITS = requestLimits.register;
const NEW_PASSWORD_LIMITS = requestLimits.changePassword.newPassword;

interface RegistrationFormData {
  email?: string;
  name?: string;
  password: string;
  confirmPassword: string;
}

interface PasswordChangeFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Validates registration form data.
 * @returns null if valid, or an error message string if invalid
 */
export function validateRegistrationForm(data: RegistrationFormData): string | null {
  if (data.email && data.email.length > REGISTER_LIMITS.email.maxLength) {
    return `Email must be ${REGISTER_LIMITS.email.maxLength} characters or less`;
  }

  if (data.name && data.name.length > REGISTER_LIMITS.name.maxLength) {
    return `Name must be ${REGISTER_LIMITS.name.maxLength} characters or less`;
  }

  if (data.password.length < REGISTER_LIMITS.password.minLength) {
    return `Password must be at least ${REGISTER_LIMITS.password.minLength} characters`;
  }

  if (data.password.length > REGISTER_LIMITS.password.maxLength) {
    return `Password must be ${REGISTER_LIMITS.password.maxLength} characters or less`;
  }

  if (data.password !== data.confirmPassword) {
    return 'Passwords do not match';
  }

  return null;
}

/**
 * Validates password change form data.
 * @returns null if valid, or an error message string if invalid
 */
export function validatePasswordChange(data: PasswordChangeFormData): string | null {
  if (!data.currentPassword) {
    return 'Current password is required';
  }

  if (data.newPassword.length < NEW_PASSWORD_LIMITS.minLength) {
    return `New password must be at least ${NEW_PASSWORD_LIMITS.minLength} characters`;
  }

  if (data.newPassword.length > NEW_PASSWORD_LIMITS.maxLength) {
    return `New password must be ${NEW_PASSWORD_LIMITS.maxLength} characters or less`;
  }

  if (data.newPassword !== data.confirmPassword) {
    return 'Passwords do not match';
  }

  return null;
}
