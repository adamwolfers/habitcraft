export const colors = {
  // Primary colors
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',

  // Secondary colors
  secondary: '#f59e0b',
  secondaryLight: '#fbbf24',
  secondaryDark: '#d97706',

  // Neutral colors
  background: '#ffffff',
  surface: '#f9fafb',
  card: '#ffffff',
  border: '#e5e7eb',

  // Text colors
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textInverse: '#ffffff',

  // Status colors
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',

  // Streak colors
  streak: '#f59e0b',
  streakFire: '#ef4444',

  // Habit completion
  completed: '#10b981',
  incomplete: '#e5e7eb',
  today: '#6366f1',
} as const;

export type ColorName = keyof typeof colors;
