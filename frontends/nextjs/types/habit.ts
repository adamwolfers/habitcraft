export interface Habit {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  frequency: 'daily' | 'weekly';
  targetDays: number[]; // Array of day numbers (0-6 for weekly, empty for daily)
  color: string;
  icon: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface HabitFormData {
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly';
  targetDays?: number[];
  color?: string;
  icon?: string;
}
