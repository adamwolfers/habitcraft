export interface Habit {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
  completedDates: string[]; // Array of ISO date strings
}

export interface HabitFormData {
  name: string;
  description?: string;
  color: string;
}
