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
  if (data.email && data.email.length > 255) {
    return 'Email must be 255 characters or less';
  }

  if (data.name && data.name.length > 100) {
    return 'Name must be 100 characters or less';
  }

  if (data.password.length < 8) {
    return 'Password must be at least 8 characters';
  }

  if (data.password.length > 72) {
    return 'Password must be 72 characters or less';
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

  if (data.newPassword.length < 8) {
    return 'New password must be at least 8 characters';
  }

  if (data.newPassword.length > 72) {
    return 'New password must be 72 characters or less';
  }

  if (data.newPassword !== data.confirmPassword) {
    return 'Passwords do not match';
  }

  return null;
}
