interface RegistrationFormData {
  password: string;
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
