import { PRESET_COLORS, PRESET_ICONS } from "./habitUtils";

export interface HabitFormState {
  name: string;
  description: string;
  color: string;
  icon: string;
}

export interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Returns default values for the habit form.
 * Used for both initial form state and resetting after submission.
 */
export function getDefaultHabitFormValues(): HabitFormState {
  return {
    name: "",
    description: "",
    color: PRESET_COLORS[0],
    icon: PRESET_ICONS[0],
  };
}

/**
 * Returns empty values for the password change form.
 * Used for clearing password fields after successful change.
 */
export function getEmptyPasswordState(): PasswordFormState {
  return {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  };
}
