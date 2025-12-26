interface RegistrationFormData {
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
  if (data.password.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (data.password !== data.confirmPassword) {
    return "Passwords do not match";
  }

  return null;
}

/**
 * Validates password change form data.
 * @returns null if valid, or an error message string if invalid
 */
export function validatePasswordChange(data: PasswordChangeFormData): string | null {
  if (!data.currentPassword) {
    return "Current password is required";
  }

  if (data.newPassword.length < 8) {
    return "New password must be at least 8 characters";
  }

  if (data.newPassword !== data.confirmPassword) {
    return "Passwords do not match";
  }

  return null;
}
