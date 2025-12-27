import { PRESET_COLORS, PRESET_ICONS } from "./habitUtils";

export interface HabitFormState {
  name: string;
  description: string;
  color: string;
  icon: string;
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
