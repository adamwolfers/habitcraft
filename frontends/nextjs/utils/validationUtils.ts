/**
 * Validate email format using a simple regex pattern.
 * Checks for: local-part@domain.tld format
 */
export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Validate profile form data.
 * Checks that name and email are non-empty after trimming,
 * and that email is in a valid format.
 */
export const isValidProfileForm = (name: string, email: string): boolean => {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  return trimmedName.length > 0 && trimmedEmail.length > 0 && validateEmail(trimmedEmail);
};
